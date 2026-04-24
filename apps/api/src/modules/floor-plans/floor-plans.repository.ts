import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type FloorPlan as PrismaFloorPlan } from '@prisma/client';
import { createEmptyFloorPlanData, type UpdateFloorPlanInput } from '@app/contracts';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * MVP scope: a project has exactly one floor plan at `level = 0`.
 * Multi-level support comes later via additional rows with `level > 0`
 * and an extended URL scheme — the unique constraint `(projectId, level)`
 * already accommodates that.
 */
export const DEFAULT_FLOOR_LEVEL = 0;

/**
 * Persistence boundary for floor plans.
 *
 * All optimistic-locking logic lives here so the service layer can stay
 * declarative. The combination of:
 *
 *   - `$transaction(async tx => …)` for atomicity,
 *   - `updateMany({ where: { id, version: expected } })` for a race-safe
 *     write (the `version` predicate is enforced at SQL level), and
 *   - a `P2002` → 409 translation inside the lazy-create branch,
 *
 * means the service never needs to think about concurrency.
 */
@Injectable()
export class FloorPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the default floor plan for `projectId`, creating an empty one
   * if none exists yet. Uses `upsert` against the `(projectId, level)`
   * unique index so two concurrent first-time readers can't race.
   *
   * IMPORTANT: this is the one place where a GET is allowed to mutate the
   * database. See class-level comment in `FloorPlansService` for the
   * rationale.
   */
  ensureDefault(projectId: string): Promise<PrismaFloorPlan> {
    const empty = createEmptyFloorPlanData();
    return this.prisma.floorPlan.upsert({
      where: { projectId_level: { projectId, level: DEFAULT_FLOOR_LEVEL } },
      create: {
        projectId,
        level: DEFAULT_FLOOR_LEVEL,
        version: 1,
        data: empty as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  /**
   * Replaces the default floor plan atomically with optimistic locking.
   *
   *   - If the plan doesn't exist yet, accept only `input.version === 1`
   *     (the client had the "empty baseline" view) and create it at
   *     version 2. A concurrent peer doing the same race-condition insert
   *     will hit the unique constraint (`P2002`); we translate that to a
   *     409 so the client sees a consistent version-conflict signal.
   *
   *   - If the plan exists and `input.version !== stored.version`, return
   *     409 without writing.
   *
   *   - Otherwise increment the version by 1 and replace `data` in a
   *     single UPDATE filtered by the expected version. If `count === 0`
   *     despite passing the in-memory check, another writer beat us
   *     between SELECT and UPDATE — surface as 409.
   */
  async replace(
    projectId: string,
    input: UpdateFloorPlanInput,
  ): Promise<PrismaFloorPlan> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.floorPlan.findUnique({
        where: { projectId_level: { projectId, level: DEFAULT_FLOOR_LEVEL } },
      });

      if (!existing) {
        if (input.version !== 1) {
          throw this.buildVersionConflict(null, input.version);
        }
        try {
          return await tx.floorPlan.create({
            data: {
              projectId,
              level: DEFAULT_FLOOR_LEVEL,
              version: 2,
              data: input.data as unknown as Prisma.InputJsonValue,
            },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            throw this.buildVersionConflict(null, input.version);
          }
          throw e;
        }
      }

      if (existing.version !== input.version) {
        throw this.buildVersionConflict(existing.version, input.version);
      }

      const nextVersion = existing.version + 1;
      const updated = await tx.floorPlan.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          version: nextVersion,
          data: input.data as unknown as Prisma.InputJsonValue,
        },
      });

      if (updated.count === 0) {
        // Between our SELECT and UPDATE another writer advanced the
        // version. Can't tell exact currentVersion without another SELECT
        // that's worth a round-trip just for an error payload — mark it
        // `null` and let the client reload.
        throw this.buildVersionConflict(null, input.version);
      }

      return tx.floorPlan.findUniqueOrThrow({ where: { id: existing.id } });
    });
  }

  private buildVersionConflict(
    currentVersion: number | null,
    clientVersion: number,
  ): ConflictException {
    return new ConflictException({
      message: 'Floor plan was modified by another client',
      error: 'Conflict',
      details: { currentVersion, clientVersion },
    });
  }
}
