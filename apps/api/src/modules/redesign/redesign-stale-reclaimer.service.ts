import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { EnvService } from '../../config/env.service';

import { RedesignRepository } from './redesign.repository';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Periodically marks PROCESSING jobs older than REDESIGN_PROCESSING_TIMEOUT_SECONDS as FAILED.
 *
 * MVP strategy: **fail closed** — no automatic return to PENDING / re-enqueue (avoids duplicate
 * workers and orphan provider calls). The user can submit a new job after a timeout.
 */
@Injectable()
export class RedesignStaleReclaimerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedesignStaleReclaimerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly env: EnvService,
    private readonly redesign: RedesignRepository,
  ) {}

  onModuleInit(): void {
    const provider = this.env.get('REDESIGN_PROVIDER');
    if (provider !== 'mock' && provider !== 'replicate') {
      this.logger.warn(`REDESIGN_PROVIDER=${provider} is unknown; expected mock or replicate.`);
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const sec = this.env.get('REDESIGN_PROCESSING_TIMEOUT_SECONDS');
      const n = await this.redesign.reclaimStaleProcessing(sec);
      if (n > 0) {
        this.logger.log(`Reclaimed ${n} stale redesign job(s) as FAILED (timeout ${sec}s)`);
      }
    } catch (err: unknown) {
      this.logger.warn(`redesign stale reclaim tick failed: ${String(err)}`);
    }
  }
}
