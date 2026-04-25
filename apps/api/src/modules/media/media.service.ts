import {
  type MediaAssetDto,
  type MediaListResponse,
  type PresignedUploadResponse,
  type RequestMediaUploadInput,
} from '@app/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { StorageService } from '../../infra/storage/storage.service';
import { ProjectsRepository } from '../projects/projects.repository';

import { buildMediaStorageKey } from './media.keys';
import { prismaMediaToDto } from './media.mapping';
import { MediaRepository } from './media.repository';

function normalizeContentType(header: string | undefined): string {
  if (!header) return '';
  return header.split(';')[0]?.trim().toLowerCase() ?? '';
}

@Injectable()
export class MediaService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly media: MediaRepository,
    private readonly storage: StorageService,
  ) {}

  async requestUpload(
    userId: string,
    projectId: string,
    input: RequestMediaUploadInput,
  ): Promise<PresignedUploadResponse> {
    await this.projects.assertOwnership(userId, projectId);
    try {
      this.storage.assertConfigured();
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException('Object storage is not configured.');
    }

    const mediaId = randomUUID();
    const storageKey = buildMediaStorageKey(userId, projectId, mediaId, input.mimeType);

    await this.media.create({
      id: mediaId,
      userId,
      projectId,
      kind: input.kind,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    try {
      const { url, headers } = await this.storage.presignPut(storageKey, input.mimeType);
      return {
        mediaId,
        uploadUrl: url,
        uploadHeaders: headers,
        expiresInSeconds: 15 * 60,
      };
    } catch (err) {
      await this.media.deleteById(mediaId);
      throw err;
    }
  }

  async confirmUpload(userId: string, projectId: string, mediaId: string): Promise<MediaAssetDto> {
    await this.projects.assertOwnership(userId, projectId);
    this.storage.assertConfigured();

    const row = await this.media.findOwnedInProject(userId, projectId, mediaId);
    if (!row) throw new NotFoundException('Media not found');

    if (row.status !== 'PENDING_UPLOAD') {
      throw new BadRequestException('Media is not awaiting upload confirmation');
    }

    const head = await this.storage.headObject(row.storageKey);
    if (!head) {
      await this.media.deleteById(mediaId);
      throw new BadRequestException('Object was not uploaded');
    }

    if (head.contentLength !== row.sizeBytes) {
      await this.storage.deleteObject(row.storageKey);
      await this.media.deleteById(mediaId);
      throw new BadRequestException('Uploaded size does not match declared size');
    }

    const ct = normalizeContentType(head.contentType);
    if (ct !== row.mimeType) {
      await this.storage.deleteObject(row.storageKey);
      await this.media.deleteById(mediaId);
      throw new BadRequestException('Uploaded content type does not match declared type');
    }

    const ready = await this.media.markReady(mediaId);
    const previewUrl = await this.storage.presignGet(ready.storageKey);
    return prismaMediaToDto(ready, previewUrl);
  }

  async list(userId: string, projectId: string): Promise<MediaListResponse> {
    await this.projects.assertOwnership(userId, projectId);
    this.storage.assertConfigured();

    const rows = await this.media.listByProject(userId, projectId);
    const items: MediaAssetDto[] = [];
    for (const row of rows) {
      let previewUrl: string | null = null;
      if (row.status === 'READY') {
        previewUrl = await this.storage.presignGet(row.storageKey);
      }
      items.push(prismaMediaToDto(row, previewUrl));
    }
    return { items };
  }

  async remove(userId: string, projectId: string, mediaId: string): Promise<void> {
    await this.projects.assertOwnership(userId, projectId);

    const row = await this.media.findOwnedInProject(userId, projectId, mediaId);
    if (!row) throw new NotFoundException('Media not found');

    await this.storage.deleteObjectIfConfigured(row.storageKey);
    await this.media.deleteById(mediaId);
  }
}
