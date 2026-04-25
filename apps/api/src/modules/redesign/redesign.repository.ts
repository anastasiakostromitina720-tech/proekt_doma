import { Injectable } from '@nestjs/common';
import type { Prisma, RedesignJob as PrismaRedesignJob } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class RedesignRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    id: string;
    userId: string;
    projectId: string;
    sourceMediaId: string;
    roomType: string;
    style: string;
    prompt: string;
    provider: string;
  }): Promise<PrismaRedesignJob> {
    return this.prisma.redesignJob.create({
      data: {
        id: data.id,
        userId: data.userId,
        projectId: data.projectId,
        sourceMediaId: data.sourceMediaId,
        roomType: data.roomType,
        style: data.style,
        prompt: data.prompt,
        status: 'PENDING',
        provider: data.provider,
      },
    });
  }

  findOwned(
    userId: string,
    projectId: string,
    jobId: string,
  ): Promise<PrismaRedesignJob | null> {
    return this.prisma.redesignJob.findFirst({
      where: { id: jobId, projectId, userId },
    });
  }

  findById(jobId: string): Promise<PrismaRedesignJob | null> {
    return this.prisma.redesignJob.findFirst({ where: { id: jobId } });
  }

  listByProject(userId: string, projectId: string): Promise<PrismaRedesignJob[]> {
    return this.prisma.redesignJob.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PENDING → PROCESSING, bump attempts, set startedAt. Only if attempts &lt; maxAttempts.
   * Returns number of rows updated (0 or 1).
   */
  transitionToProcessing(id: string, maxAttempts: number): Promise<number> {
    return this.prisma.redesignJob
      .updateMany({
        where: {
          id,
          status: 'PENDING',
          attempts: { lt: maxAttempts },
        },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      })
      .then((r) => r.count);
  }

  /**
   * FAILED from PENDING or PROCESSING only — never overwrites SUCCEEDED.
   * Returns rows updated.
   */
  markFailed(id: string, errorMessage: string): Promise<number> {
    const msg = errorMessage.slice(0, 4000);
    return this.prisma.redesignJob
      .updateMany({
        where: {
          id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'FAILED',
          errorMessage: msg,
          resultMediaId: null,
          completedAt: new Date(),
          lastErrorAt: new Date(),
        },
      })
      .then((r) => r.count);
  }

  /**
   * Persist Replicate prediction id while the job stays PROCESSING.
   */
  setExternalJobIdForProcessing(jobId: string, externalJobId: string): Promise<number> {
    return this.prisma.redesignJob
      .updateMany({
        where: { id: jobId, status: 'PROCESSING' },
        data: { externalJobId },
      })
      .then((r) => r.count);
  }

  /**
   * PROCESSING → SUCCEEDED inside a transaction. Returns rows updated (expect 1).
   */
  completeSucceededInTx(
    tx: Prisma.TransactionClient,
    jobId: string,
    resultMediaId: string,
  ): Promise<number> {
    return tx.redesignJob
      .updateMany({
        where: { id: jobId, status: 'PROCESSING' },
        data: {
          status: 'SUCCEEDED',
          resultMediaId,
          errorMessage: null,
          lastErrorAt: null,
          completedAt: new Date(),
        },
      })
      .then((r) => r.count);
  }

  /**
   * MVP reclaim: stale PROCESSING → FAILED (no auto re-enqueue). User creates a new job if needed.
   */
  async reclaimStaleProcessing(timeoutSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
    const message = 'Processing timed out (stale PROCESSING reclaimed)';
    const result = await this.prisma.redesignJob.updateMany({
      where: {
        status: 'PROCESSING',
        OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, updatedAt: { lt: cutoff } }],
      },
      data: {
        status: 'FAILED',
        errorMessage: message,
        resultMediaId: null,
        completedAt: new Date(),
        lastErrorAt: new Date(),
      },
    });
    return result.count;
  }
}
