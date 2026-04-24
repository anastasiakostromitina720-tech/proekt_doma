import { Injectable } from '@nestjs/common';
import type { MediaAsset as PrismaMedia, MediaKind, MediaStatus } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    id: string;
    userId: string;
    projectId: string;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<PrismaMedia> {
    return this.prisma.mediaAsset.create({
      data: {
        id: input.id,
        userId: input.userId,
        projectId: input.projectId,
        kind: input.kind,
        status: 'PENDING_UPLOAD',
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
  }

  findOwnedInProject(
    userId: string,
    projectId: string,
    mediaId: string,
  ): Promise<PrismaMedia | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, projectId, userId },
    });
  }

  listByProject(userId: string, projectId: string): Promise<PrismaMedia[]> {
    return this.prisma.mediaAsset.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.mediaAsset.deleteMany({ where: { id } });
  }

  async markReady(id: string): Promise<PrismaMedia> {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'READY' },
    });
  }
}
