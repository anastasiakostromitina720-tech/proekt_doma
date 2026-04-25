import {
  type CreateRedesignJobInput,
  type RedesignJobDto,
  type RedesignJobListResponse,
  type RedesignJobStatus,
  type RedesignRoomType,
  type RedesignStyle,
} from '@app/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RedesignJob as PrismaRedesignJob } from '@prisma/client';
import { randomUUID } from 'crypto';

import { EnvService } from '../../config/env.service';
import { StorageService } from '../../infra/storage/storage.service';
import { MediaRepository } from '../media/media.repository';
import { ProjectsRepository } from '../projects/projects.repository';

import { RedesignJobRunner } from './redesign-job.runner';
import { RedesignRepository } from './redesign.repository';

@Injectable()
export class RedesignService {
  constructor(
    private readonly env: EnvService,
    private readonly projects: ProjectsRepository,
    private readonly redesign: RedesignRepository,
    private readonly media: MediaRepository,
    private readonly storage: StorageService,
    private readonly runner: RedesignJobRunner,
  ) {}

  async createJob(
    userId: string,
    projectId: string,
    input: CreateRedesignJobInput,
  ): Promise<RedesignJobDto> {
    await this.projects.assertOwnership(userId, projectId);

    const source = await this.media.findOwnedInProject(userId, projectId, input.sourceMediaId);
    if (!source || source.status !== 'READY') {
      throw new BadRequestException('Source media not found or not ready');
    }

    const jobId = randomUUID();
    const job = await this.redesign.create({
      id: jobId,
      userId,
      projectId,
      sourceMediaId: input.sourceMediaId,
      roomType: input.roomType,
      style: input.style,
      prompt: input.prompt,
      provider: this.env.get('REDESIGN_PROVIDER'),
    });

    this.runner.enqueue(job.id);
    return this.toDto(job);
  }

  async getJob(userId: string, projectId: string, jobId: string): Promise<RedesignJobDto> {
    await this.projects.assertOwnership(userId, projectId);
    const job = await this.redesign.findOwned(userId, projectId, jobId);
    if (!job) throw new NotFoundException('Job not found');
    return this.toDto(job);
  }

  async listJobs(userId: string, projectId: string): Promise<RedesignJobListResponse> {
    await this.projects.assertOwnership(userId, projectId);
    const rows = await this.redesign.listByProject(userId, projectId);
    const items = await Promise.all(rows.map((j) => this.toDto(j)));
    return { items };
  }

  private async toDto(job: PrismaRedesignJob): Promise<RedesignJobDto> {
    let resultPreviewUrl: string | null = null;
    if (job.status === 'SUCCEEDED' && job.resultMediaId) {
      const media = await this.media.findOwnedInProject(job.userId, job.projectId, job.resultMediaId);
      if (media && this.storage.isConfigured()) {
        try {
          resultPreviewUrl = await this.storage.presignGet(media.storageKey);
        } catch {
          resultPreviewUrl = null;
        }
      }
    }

    return {
      id: job.id,
      projectId: job.projectId,
      sourceMediaId: job.sourceMediaId,
      resultMediaId: job.resultMediaId,
      roomType: job.roomType as RedesignRoomType,
      style: job.style as RedesignStyle,
      prompt: job.prompt,
      status: job.status as RedesignJobStatus,
      errorMessage: job.errorMessage,
      resultPreviewUrl,
      provider: job.provider,
      externalJobId: job.externalJobId,
      attempts: job.attempts,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      lastErrorAt: job.lastErrorAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
