import type { User as PrismaUser } from '@prisma/client';
import type { User } from '@app/contracts';

export const toUserDto = (u: PrismaUser): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});
