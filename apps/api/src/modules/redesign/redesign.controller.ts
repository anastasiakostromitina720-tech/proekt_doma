import {
  type CreateRedesignJobInput,
  type RedesignJobDto,
  type RedesignJobListResponse,
  createRedesignJobSchema,
  uuidSchema,
} from '@app/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../types/express';

import { RedesignService } from './redesign.service';

@Controller('projects/:projectId/redesign/jobs')
export class RedesignController {
  constructor(private readonly redesign: RedesignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Body(new ZodValidationPipe(createRedesignJobSchema)) dto: CreateRedesignJobInput,
  ): Promise<RedesignJobDto> {
    return this.redesign.createJob(user.id, projectId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
  ): Promise<RedesignJobListResponse> {
    return this.redesign.listJobs(user.id, projectId);
  }

  @Get(':jobId')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ZodValidationPipe(uuidSchema)) projectId: string,
    @Param('jobId', new ZodValidationPipe(uuidSchema)) jobId: string,
  ): Promise<RedesignJobDto> {
    return this.redesign.getJob(user.id, projectId, jobId);
  }
}
