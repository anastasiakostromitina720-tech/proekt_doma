import { Injectable, Logger } from '@nestjs/common';
import { allowedImageMimeSchema, type AllowedImageMime } from '@app/contracts';
import { randomUUID } from 'crypto';

import { EnvService } from '../../config/env.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { buildMediaStorageKey } from '../media/media.keys';
import { MediaRepository } from '../media/media.repository';

import { RedesignJobRunner } from './redesign-job.runner';
import { RedesignRepository } from './redesign.repository';
import { ReplicateClient } from './replicate-client.service';

const POLL_MS = 2000;
/** Transient getPrediction failures (429 / 5xx / network) before failing the job. */
const POLL_TRANSIENT_MAX_ATTEMPTS = 15;
const POLL_BACKOFF_INITIAL_MS = 1000;
const POLL_BACKOFF_CAP_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildReplicatePrompt(roomType: string, style: string, userPrompt: string): string {
  return `Interior redesign. Room type: ${roomType}. Style: ${style}. ${userPrompt}`.trim();
}

function isHttpImageUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith('http://') || t.startsWith('https://');
}

/**
 * Replicate `output`: string URL, string[], { url }, { url }[], or mixed arrays.
 */
function extractOutputImageUrl(output: unknown): string | null {
  if (typeof output === 'string') {
    if (isHttpImageUrl(output)) return output.trim();
    return null;
  }

  if (output && typeof output === 'object' && !Array.isArray(output) && 'url' in output) {
    const u = (output as { url: unknown }).url;
    if (typeof u === 'string' && isHttpImageUrl(u)) return u.trim();
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'string' && isHttpImageUrl(item)) return item.trim();
      if (item && typeof item === 'object' && !Array.isArray(item) && 'url' in item) {
        const u = (item as { url: unknown }).url;
        if (typeof u === 'string' && isHttpImageUrl(u)) return u.trim();
      }
    }
    return null;
  }

  return null;
}

function mimeForResultAsset(contentTypeHeader: string): AllowedImageMime {
  const base = contentTypeHeader.split(';')[0]?.trim().toLowerCase() ?? '';
  const parsed = allowedImageMimeSchema.safeParse(base);
  if (parsed.success) return parsed.data;
  return 'image/png';
}

function replicateTerminalErrorMessage(error: unknown, statusLabel: string): string {
  if (error == null) {
    return `Replicate status: ${statusLabel}`;
  }
  if (typeof error === 'string') {
    const t = error.trim();
    if (t) return t.slice(0, 4000);
    return `Replicate status: ${statusLabel}`;
  }
  if (typeof error === 'object' && error !== null) {
    if ('message' in error) {
      const m = (error as { message: unknown }).message;
      if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 4000);
    }
    if ('detail' in error) {
      const d = (error as { detail: unknown }).detail;
      if (typeof d === 'string' && d.trim()) return d.trim().slice(0, 4000);
    }
    try {
      const s = JSON.stringify(error);
      if (s && s !== '{}') return s.slice(0, 4000);
    } catch {
      /* ignore */
    }
  }
  return `Replicate status: ${statusLabel}`;
}

function isTransientGetPredictionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Replicate rate limited (429)') ||
    msg.includes('Replicate server error (') ||
    msg.includes('Network error calling Replicate API:')
  );
}

/**
 * Replicate-backed runner: creates a prediction, polls on the server, downloads the output,
 * uploads to our bucket, creates REDESIGN_RESULT media.
 *
 * **Input URL:** Replicate's servers must fetch the source image from `image` in the prediction
 * input — use a presigned GET that is reachable from the public internet (not localhost-only MinIO).
 */
@Injectable()
export class ReplicateRedesignJobRunner extends RedesignJobRunner {
  private readonly logger = new Logger(ReplicateRedesignJobRunner.name);

  constructor(
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaRepository,
    private readonly redesign: RedesignRepository,
    private readonly replicate: ReplicateClient,
  ) {
    super();
  }

  enqueue(jobId: string): void {
    void this.run(jobId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`replicate redesign job ${jobId} crashed: ${msg}`);
    });
  }

  private async run(jobId: string): Promise<void> {
    const maxAttempts = this.env.get('REDESIGN_MAX_ATTEMPTS');
    const picked = await this.redesign.transitionToProcessing(jobId, maxAttempts);
    if (picked === 0) {
      const job = await this.redesign.findById(jobId);
      if (job?.status === 'PENDING' && job.attempts >= maxAttempts) {
        await this.redesign.markFailed(jobId, 'Max processing attempts exceeded');
      }
      return;
    }

    let destKey: string | null = null;
    try {
      this.storage.assertConfigured();

      const job = await this.redesign.findById(jobId);
      if (!job) {
        throw new Error('Job disappeared');
      }
      if (job.status !== 'PROCESSING') {
        throw new Error(`Job is no longer PROCESSING (got ${job.status})`);
      }

      const source = await this.media.findOwnedInProject(job.userId, job.projectId, job.sourceMediaId);
      if (!source || source.status !== 'READY') {
        throw new Error('Source media is not available');
      }

      if (!allowedImageMimeSchema.safeParse(source.mimeType).success) {
        throw new Error('Source MIME type is not allowed for redesign');
      }

      const imageUrl = await this.storage.presignGet(source.storageKey);
      const prompt = buildReplicatePrompt(job.roomType, job.style, job.prompt);

      const prediction = await this.replicate.createPrediction({
        image: imageUrl,
        prompt,
      });

      const extId = prediction.id;
      if (!extId) {
        throw new Error('Replicate did not return a prediction id');
      }

      const extSaved = await this.redesign.setExternalJobIdForProcessing(jobId, extId);
      if (extSaved === 0) {
        this.logger.warn(`job ${jobId} lost PROCESSING before external id could be saved`);
        return;
      }

      const startMs = job.startedAt?.getTime() ?? Date.now();
      const deadlineMs = startMs + this.env.get('REDESIGN_PROCESSING_TIMEOUT_SECONDS') * 1000;

      let terminal: Awaited<ReturnType<ReplicateClient['getPrediction']>> | null = null;
      let transientFailures = 0;
      let backoffMs = POLL_BACKOFF_INITIAL_MS;

      while (Date.now() < deadlineMs) {
        const row = await this.redesign.findById(jobId);
        if (!row || row.status !== 'PROCESSING') {
          this.logger.warn(`job ${jobId} no longer PROCESSING during Replicate poll; stopping worker`);
          return;
        }

        let pred: Awaited<ReturnType<ReplicateClient['getPrediction']>>;
        try {
          pred = await this.replicate.getPrediction(extId);
          transientFailures = 0;
          backoffMs = POLL_BACKOFF_INITIAL_MS;
        } catch (e: unknown) {
          if (!isTransientGetPredictionError(e)) {
            throw e;
          }
          transientFailures += 1;
          const lastHint = e instanceof Error ? e.message : String(e);
          if (transientFailures > POLL_TRANSIENT_MAX_ATTEMPTS) {
            throw new Error(
              `Replicate polling exhausted after ${POLL_TRANSIENT_MAX_ATTEMPTS} transient errors (429/5xx/network): ${lastHint}`,
            );
          }
          this.logger.warn(
            `getPrediction transient failure for job ${jobId} (${transientFailures}/${POLL_TRANSIENT_MAX_ATTEMPTS}): ${lastHint}`,
          );
          const wait = Math.min(backoffMs, Math.max(0, deadlineMs - Date.now()));
          if (wait > 0) {
            await delay(wait);
          }
          backoffMs = Math.min(backoffMs * 2, POLL_BACKOFF_CAP_MS);
          continue;
        }

        const st = pred.status?.toLowerCase() ?? '';

        if (st === 'succeeded') {
          terminal = pred;
          break;
        }
        if (st === 'failed' || st === 'canceled') {
          throw new Error(replicateTerminalErrorMessage(pred.error, pred.status));
        }

        await delay(POLL_MS);
      }

      if (!terminal) {
        throw new Error('Replicate prediction timed out (local deadline)');
      }

      const outUrl = extractOutputImageUrl(terminal.output);
      if (!outUrl) {
        throw new Error('Replicate output is empty or not a supported image URL');
      }

      const maxResultBytes = this.env.get('REDESIGN_RESULT_MAX_BYTES');
      const { buf, contentType } = await this.downloadResultImage(outUrl, maxResultBytes);
      const resultMime = mimeForResultAsset(contentType);
      const newMediaId = randomUUID();
      destKey = buildMediaStorageKey(job.userId, job.projectId, newMediaId, resultMime);

      await this.storage.putObject(destKey, buf, resultMime);

      await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.create({
          data: {
            id: newMediaId,
            userId: job.userId,
            projectId: job.projectId,
            kind: 'REDESIGN_RESULT',
            status: 'READY',
            storageKey: destKey!,
            mimeType: resultMime,
            sizeBytes: buf.length,
          },
        });
        const n = await this.redesign.completeSucceededInTx(tx, jobId, newMediaId);
        if (n === 0) {
          throw new Error('Job not in PROCESSING state (success race or reclaim)');
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (destKey) {
        try {
          await this.storage.deleteObjectIfConfigured(destKey);
        } catch (delErr: unknown) {
          this.logger.warn(`S3 cleanup failed for redesign job ${jobId}: ${String(delErr)}`);
        }
      }
      try {
        const n = await this.redesign.markFailed(jobId, message);
        if (n === 0) {
          this.logger.debug(`markFailed no-op for job ${jobId} (already terminal?)`);
        }
      } catch (mfErr: unknown) {
        this.logger.error(`markFailed failed for redesign job ${jobId}: ${String(mfErr)}`);
      }
    }
  }

  private async downloadResultImage(
    url: string,
    maxBytes: number,
  ): Promise<{ buf: Buffer; contentType: string }> {
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'follow' });
    } catch (e: unknown) {
      throw new Error(`Network error downloading result image: ${String(e)}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to download result image (${res.status})`);
    }

    const clHeader = res.headers.get('content-length');
    if (clHeader) {
      const declared = Number.parseInt(clHeader, 10);
      if (!Number.isNaN(declared) && declared > maxBytes) {
        throw new Error(
          `Result image too large (Content-Length ${declared} bytes, max ${maxBytes} bytes)`,
        );
      }
    }

    const ct = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';

    const reader = res.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) {
        throw new Error(`Result image exceeds max size (${maxBytes} bytes)`);
      }
      return { buf, contentType: ct || 'application/octet-stream' };
    }

    const chunks: Buffer[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new Error(`Result image exceeds max size (${maxBytes} bytes)`);
          }
          chunks.push(Buffer.from(value));
        }
      }
    } catch (readErr: unknown) {
      await reader.cancel().catch(() => undefined);
      throw readErr;
    }

    return {
      buf: Buffer.concat(chunks),
      contentType: ct || 'application/octet-stream',
    };
  }
}
