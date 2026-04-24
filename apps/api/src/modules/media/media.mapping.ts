import type { MediaAsset as PrismaMedia } from '@prisma/client';
import type { MediaAssetDto, MediaKind, MediaStatus } from '@app/contracts';

export function prismaMediaToDto(asset: PrismaMedia, previewUrl: string | null): MediaAssetDto {
  return {
    id: asset.id,
    projectId: asset.projectId,
    kind: asset.kind as MediaKind,
    status: asset.status as MediaStatus,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    previewUrl,
    createdAt: asset.createdAt.toISOString(),
  };
}
