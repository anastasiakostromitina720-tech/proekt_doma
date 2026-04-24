import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  type FloorPlan,
  type UpdateFloorPlanInput,
  updateFloorPlanSchema,
  uuidSchema,
} from '@app/contracts';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../types/express';
import { FloorPlansService } from './floor-plans.service';

/**
 * Floor plan REST endpoints.
 *
 *   GET  /projects/:projectId/floor-plan
 *   PUT  /projects/:projectId/floor-plan
 *
 * Nested under `/projects/:projectId` because a floor plan has no
 * standalone lifecycle — it always belongs to a project. The URL
 * intentionally ends with `/floor-plan` (singular) because the MVP
 * exposes exactly one default plan per project; multi-level support
 * will add `/floor-plans/:level` alongside, without breaking this route.
 */
@Controller('projects/:projectId/floor-plan')
export class FloorPlansController {
  constructor(private readonly floorPlans: FloorPlansService) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
  ): Promise<FloorPlan> {
    return this.floorPlans.get(user.id, projectId);
  }

  @Put()
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Body(new ZodValidationPipe(updateFloorPlanSchema)) dto: UpdateFloorPlanInput,
  ): Promise<FloorPlan> {
    return this.floorPlans.save(user.id, projectId, dto);
  }
}
