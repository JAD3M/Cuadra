import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule } from '../redis/redis.module';
import { LimiteGuard } from './limite.guard';
import { LimiteInterceptor } from './limite.interceptor';

/**
 * Guard e interceptor globales del límite. Quien los registra decide el
 * orden: `AuthModule` los pone primero, antes de `SesionCookieGuard`.
 */
export const PROVEEDORES_LIMITE: Provider[] = [
  { provide: APP_GUARD, useClass: LimiteGuard },
  { provide: APP_INTERCEPTOR, useClass: LimiteInterceptor },
];

/** Trae el cliente Redis compartido que usan el guard y el interceptor. */
@Module({ imports: [RedisModule], exports: [RedisModule] })
export class LimiteModule {}
