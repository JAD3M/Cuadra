import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextoEmpresa } from './contexto-empresa';
import { TransaccionEmpresa } from './transaccion-empresa';
import { TransaccionEmpresaInterceptor } from './transaccion-empresa.interceptor';

/**
 * Global: cualquier módulo de dominio inyecta `ContextoEmpresa` (peticiones)
 * o `TransaccionEmpresa` (workers) sin importarlo.
 */
@Global()
@Module({
  providers: [
    ContextoEmpresa,
    TransaccionEmpresa,
    { provide: APP_INTERCEPTOR, useClass: TransaccionEmpresaInterceptor },
  ],
  exports: [ContextoEmpresa, TransaccionEmpresa],
})
export class ContextoEmpresaModule {}
