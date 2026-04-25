import { Injectable, Logger } from '@nestjs/common';
import { allowedImageMimeSchema } from '@app/contracts';
import { randomUUID } from 'crypto';

import { EnvService } from '../../config/env.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { buildMediaStorageKey } from '../media/media.keys';
import { MediaRepository } from '../media/media.repository';

import { RedesignRepository } from './redesign.repository';

const MOCK_DELAY_MS_MIN = 1200;
const MOCK_DELAY_MS_MAX = 2800;

function mockDelayMs(): number {
  return MOCK_DELAY_MS_MIN + Math.floor(Math.random() * (MOCK_DELAY_MS_MAX - MOCK_DELAY_MS_MIN));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pluggable entry point for async redesign processing. Replace implementation
 * (e.g. with a Replicate-backed runner) without changing HTTP handlers.
 */
@Injectable()
export abstract class RedesignJobRunner {
  abstract enqueue(jobId: string): void;
}

/**
 * Mock pipeline: waits, then copies the source object in S3 to a new key and
 * inserts `MediaAsset` with kind REDESIGN_RESULT (no generative model, no binary in HTTP).
 */
@Injectable()
export class MockRedesignJobRunner extends RedesignJobRunner {
  private readonly logger = new Logger(MockRedesignJobRunner.name);

  constructor(
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaRepository,
    private readonly redesign: RedesignRepository,
  ) {
    super();
  }

  enqueue(jobId: string): void {
    void this.run(jobId).catch((err: unknown) => {
      this.logger.error(`redesign job ${jobId} crashed: ${String(err)}`);
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
      await delay(mockDelayMs());

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

      const mimeParsed = allowedImageMimeSchema.safeParse(source.mimeType);
      if (!mimeParsed.success) {
        throw new Error('Source MIME type is not allowed for redesign');
      }

      const newMediaId = randomUUID();
      destKey = buildMediaStorageKey(job.userId, job.projectId, newMediaId, mimeParsed.data);

      await this.storage.copyObject(source.storageKey, destKey);

      await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.create({
          data: {
            id: newMediaId,
            userId: job.userId,
            projectId: job.projectId,
            kind: 'REDESIGN_RESULT',
            status: 'READY',
            storageKey: destKey!,
            mimeType: source.mimeType,
            sizeBytes: source.sizeBytes,
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
        await this.storage.deleteObjectIfConfigured(destKey);
      }
      const n = await this.redesign.markFailed(jobId, message);
      if (n === 0) {
        this.logger.debug(`markFailed no-op for job ${jobId} (already terminal?)`);
      }
    }
  }
}
