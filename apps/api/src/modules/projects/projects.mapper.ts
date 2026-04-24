import type { Project as PrismaProject } from '@prisma/client';
import type { Project } from '@app/contracts';

export const toProjectDto = (p: PrismaProject): Project => ({
  id: p.id,
  userId: p.userId,
  name: p.name,
  description: p.description,
  type: p.type,
  thumbnailUrl: p.thumbnailUrl,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
