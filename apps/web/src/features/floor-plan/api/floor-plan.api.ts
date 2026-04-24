import type { FloorPlan, UpdateFloorPlanInput } from '@app/contracts';

import { api } from '@/shared/api/client';

/**
 * Thin REST wrapper for floor-plan persistence.
 *
 *   GET  /projects/:projectId/floor-plan    → load (lazy-creates on server)
 *   PUT  /projects/:projectId/floor-plan    → full replace, optimistic lock
 *
 * The server is the single source of truth for `version`. Callers must
 * pass back the `version` they last received; a stale value yields a 409
 * with `details: { currentVersion, clientVersion }`.
 */
export const floorPlanApi = {
  get: (projectId: string): Promise<FloorPlan> =>
    api.get<FloorPlan>(`/projects/${projectId}/floor-plan`),

  save: (projectId: string, input: UpdateFloorPlanInput): Promise<FloorPlan> =>
    api.put<FloorPlan>(`/projects/${projectId}/floor-plan`, input),
};
