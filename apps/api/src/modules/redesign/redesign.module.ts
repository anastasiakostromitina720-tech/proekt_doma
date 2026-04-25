import { Module } from '@nestjs/common';

import { EnvService } from '../../config/env.service';
import { MediaModule } from '../media/media.module';
import { ProjectsModule } from '../projects/projects.module';

import { MockRedesignJobRunner, RedesignJobRunner } from './redesign-job.runner';
import { RedesignController } from './redesign.controller';
import { RedesignRepository } from './redesign.repository';
import { RedesignService } from './redesign.service';
import { RedesignStaleReclaimerService } from './redesign-stale-reclaimer.service';
import { ReplicateRedesignJobRunner } from './replicate-redesign-job.runner';
import { ReplicateClient } from './replicate-client.service';

@Module({
  imports: [ProjectsModule, MediaModule],
  controllers: [RedesignController],
  providers: [
    RedesignRepository,
    RedesignService,
    RedesignStaleReclaimerService,
    ReplicateClient,
    MockRedesignJobRunner,
    ReplicateRedesignJobRunner,
    {
      provide: RedesignJobRunner,
      useFactory: (
        env: EnvService,
        mock: MockRedesignJobRunner,
        replicate: ReplicateRedesignJobRunner,
      ): RedesignJobRunner => {
        return env.get('REDESIGN_PROVIDER') === 'replicate' ? replicate : mock;
      },
      inject: [EnvService, MockRedesignJobRunner, ReplicateRedesignJobRunner],
    },
  ],
})
export class RedesignModule {}
