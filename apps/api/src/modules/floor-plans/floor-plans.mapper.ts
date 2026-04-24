import { InternalServerErrorException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan } from '@prisma/client';
import { floorPlanDataSchema, type FloorPlan } from '@app/contracts';

/**
 * Converts a Prisma `FloorPlan` row into the contract `FloorPlan` DTO.
 *
 * The `data` column is `Json` in Postgres, which Prisma hands us as
 * `Prisma.JsonValue`. We deliberately re-parse it through
 * `floorPlanDataSchema` before returning so that:
 *
 *   1. The client never sees a blob that silently violates the current
 *      schema (e.g. a row left over from a dev-branch with a different
 *      shape).
 *   2. When `FLOOR_PLAN_SCHEMA_VERSION` bumps in the future, the
 *      mismatch surfaces at a precise, loggable boundary instead of
 *      leaking corrupted data into the editor.
 *
 * For MVP (v1 only) a parse failure is treated as a server-side
 * inconsistency — there is no migration path yet, so the right thing is
 * to surface a 500 and investigate, not to paper over it.
 */
export const toFloorPlanDto = (p: PrismaFloorPlan): FloorPlan => {
  const parsed = floorPlanDataSchema.safeParse(p.data);
  if (!parsed.success) {
    throw new InternalServerErrorException(
      `Stored floor plan failed schema validation (projectId=${p.projectId}, level=${p.level})`,
    );
  }

  return {
    id: p.id,
    projectId: p.projectId,
    level: p.level,
    version: p.version,
    data: parsed.data,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
};
