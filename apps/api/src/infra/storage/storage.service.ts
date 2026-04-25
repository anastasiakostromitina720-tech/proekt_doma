import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { EnvService } from '../../config/env.service';

const PRESIGN_PUT_EXPIRES_SEC = 15 * 60;
const PRESIGN_GET_EXPIRES_SEC = 60 * 60;

export interface HeadObjectResult {
  contentLength: number;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly opsClient: S3Client;
  private readonly signClient: S3Client;

  constructor(private readonly env: EnvService) {
    const e = env.all;
    const endpoint = e.STORAGE_ENDPOINT;
    const publicEndpoint = e.STORAGE_PUBLIC_URL ?? e.STORAGE_ENDPOINT;
    const region = e.STORAGE_REGION ?? 'us-east-1';
    const accessKeyId = e.STORAGE_ACCESS_KEY ?? '';
    const secretAccessKey = e.STORAGE_SECRET_KEY ?? '';
    const forcePathStyle = e.STORAGE_FORCE_PATH_STYLE !== false;
    this.bucket = e.STORAGE_BUCKET ?? '';

    const credentials =
      accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    this.opsClient = new S3Client({
      region,
      endpoint: endpoint ?? undefined,
      credentials,
      forcePathStyle,
    });

    this.signClient = new S3Client({
      region,
      endpoint: publicEndpoint ?? undefined,
      credentials,
      forcePathStyle,
    });
  }

  isConfigured(): boolean {
    const e = this.env.all;
    return !!(
      e.STORAGE_ENDPOINT &&
      e.STORAGE_BUCKET &&
      e.STORAGE_ACCESS_KEY &&
      e.STORAGE_SECRET_KEY
    );
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Object storage is not configured (STORAGE_* env vars).',
      );
    }
  }

  get bucketName(): string {
    return this.bucket;
  }

  async presignPut(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }> {
    this.assertConfigured();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.signClient, command, { expiresIn: PRESIGN_PUT_EXPIRES_SEC });
    return {
      url,
      headers: { 'Content-Type': contentType },
    };
  }

  async presignGet(key: string): Promise<string> {
    this.assertConfigured();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.signClient, command, { expiresIn: PRESIGN_GET_EXPIRES_SEC });
  }

  /**
   * Server-side copy within the same bucket (no bytes through HTTP handlers).
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    this.assertConfigured();
    const CopySource = `${this.bucket}/${sourceKey}`;
    await this.opsClient.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: destinationKey,
        CopySource,
      }),
    );
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    this.assertConfigured();
    try {
      const out: HeadObjectCommandOutput = await this.opsClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const len = out.ContentLength;
      if (typeof len !== 'number') return null;
      return { contentLength: len, contentType: out.ContentType };
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.opsClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return;
      throw err;
    }
  }

  /** Deletes the key when storage env is present; no-op otherwise (e.g. local dev without MinIO). */
  async deleteObjectIfConfigured(key: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await this.opsClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return;
      throw err;
    }
  }

  /** Upload bytes from the API worker (e.g. Replicate result) — not exposed to browsers. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertConfigured();
    await this.opsClient.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
