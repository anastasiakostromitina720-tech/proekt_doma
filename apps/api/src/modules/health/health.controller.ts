import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { HealthService, type HealthCheckResult } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  check(): Promise<HealthCheckResult> {
    return this.health.check();
  }
}
