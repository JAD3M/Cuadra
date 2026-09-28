import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ContextoEmpresa } from './contexto-empresa';
import { TransaccionEmpresaInterceptor } from './transaccion-empresa.interceptor';

/** Global: cualquier módulo de dominio inyecta `ContextoEmpresa` sin importarlo. */
@Global()
@Module({
  providers: [
    ContextoEmpresa,
    { provide: APP_INTERCEPTOR, useClass: TransaccionEmpresaInterceptor },
  ],
  exports: [ContextoEmpresa],
})
export class ContextoEmpresaModule {}
