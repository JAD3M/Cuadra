// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Publico } from '../common/decorators/decoradores';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @Publico()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
