import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module';
import { FloorPlansController } from './floor-plans.controller';
import { FloorPlansRepository } from './floor-plans.repository';
import { FloorPlansService } from './floor-plans.service';

/**
 * `ProjectsModule` is imported for its exported `ProjectsRepository`,
 * which owns the `assertOwnership(userId, projectId)` helper. That keeps
 * the ownership rule in one place and makes the dependency explicit in
 * the module graph.
 */
@Module({
  imports: [ProjectsModule],
  controllers: [FloorPlansController],
  providers: [FloorPlansService, FloorPlansRepository],
  exports: [FloorPlansService],
})
export class FloorPlansModule {}
