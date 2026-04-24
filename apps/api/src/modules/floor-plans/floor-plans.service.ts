import { Injectable } from '@nestjs/common';
import type { FloorPlan, UpdateFloorPlanInput } from '@app/contracts';

import { ProjectsRepository } from '../projects/projects.repository';
import { FloorPlansRepository } from './floor-plans.repository';
import { toFloorPlanDto } from './floor-plans.mapper';

/**
 * Application service for floor plans.
 *
 * Ownership strategy: every read/write first calls
 * `ProjectsRepository.assertOwnership(userId, projectId)`. If the project
 * doesn't exist OR doesn't belong to the caller, that method throws 404 —
 * we deliberately mirror the projects module's enumeration-safe behavior.
 * Only after ownership is confirmed do we touch `floor_plans`.
 *
 * Lazy-create-on-GET: `get` will materialise an empty floor plan if none
 * exists yet, so the editor never has to deal with an "empty-not-created"
 * state. The tradeoff is that GET can mutate the database once per
 * project — see `FloorPlansRepository.ensureDefault` for the discussion.
 */
@Injectable()
export class FloorPlansService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly repository: FloorPlansRepository,
  ) {}

  async get(userId: string, projectId: string): Promise<FloorPlan> {
    await this.projects.assertOwnership(userId, projectId);
    const plan = await this.repository.ensureDefault(projectId);
    return toFloorPlanDto(plan);
  }

  async save(
    userId: string,
    projectId: string,
    input: UpdateFloorPlanInput,
  ): Promise<FloorPlan> {
    await this.projects.assertOwnership(userId, projectId);
    const plan = await this.repository.replace(projectId, input);
    return toFloorPlanDto(plan);
  }
}
