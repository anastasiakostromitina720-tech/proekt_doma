import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Project as PrismaProject } from '@prisma/client';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from '@app/contracts';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Persistence boundary for projects.
 *
 * The repository is the single place that understands "a project belongs to
 * a user". Keeping ownership logic here (instead of duplicating
 * `if (!p || p.userId !== userId)` across service methods) gives us:
 *
 *   1. One race-safe pattern for writes: every mutation goes through
 *      `updateMany` / `deleteMany` with the composite `{ id, userId }`
 *      filter, so a concurrent delete by another client can never cause a
 *      cross-user write or a spurious 500.
 *
 *   2. A reusable `assertOwnership(userId, projectId)` entry point for
 *      other modules that attach to projects (floor-plans, media assets,
 *      redesign jobs). They can call it before their own mutations without
 *      having to reimplement the ownership check.
 *
 * All not-found / not-owned situations surface as `NotFoundException` —
 * returning 403 would let a caller enumerate which project ids exist in
 * the system.
 */
@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForUser(
    userId: string,
    query: ListProjectsQuery,
  ): Promise<[PrismaProject[], number]> {
    return this.prisma.$transaction([
      this.prisma.project.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.project.count({ where: { userId } }),
    ]);
  }

  async findOneOwned(userId: string, id: string): Promise<PrismaProject> {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  createForUser(userId: string, input: CreateProjectInput): Promise<PrismaProject> {
    return this.prisma.project.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
      },
    });
  }

  /**
   * Updates a user-owned project atomically.
   *
   * We run `updateMany` + `findUniqueOrThrow` inside a single transaction so
   * the row-level lock taken by UPDATE is held across the subsequent SELECT.
   * That eliminates the classic read-after-write race where the row is
   * deleted between the two statements and the service ends up returning a
   * 500 instead of a 404.
   *
   * If `thumbnailUrl` ever needs to be editable by clients again, extend
   * both this method and the Zod schema deliberately — it's intentionally
   * not exposed here.
   */
  async updateOwned(
    userId: string,
    id: string,
    input: UpdateProjectInput,
  ): Promise<PrismaProject> {
    const data: Prisma.ProjectUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.project.updateMany({ where: { id, userId }, data });
      if (result.count === 0) {
        throw new NotFoundException('Project not found');
      }
      return tx.project.findUniqueOrThrow({ where: { id } });
    });
  }

  async deleteOwned(userId: string, id: string): Promise<void> {
    const result = await this.prisma.project.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      throw new NotFoundException('Project not found');
    }
  }

  /**
   * For modules that attach sub-resources to a project (floor-plans, media,
   * AI jobs). Throws 404 if the project is missing or not owned.
   */
  async assertOwnership(userId: string, id: string): Promise<void> {
    const count = await this.prisma.project.count({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Project not found');
    }
  }
}
