import { Module } from '@nestjs/common';

import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
  // `ProjectsRepository` is exported so that future modules (floor-plans,
  // media, AI jobs) can call `assertOwnership(userId, projectId)` before
  // mutating sub-resources — we don't want that check duplicated.
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
