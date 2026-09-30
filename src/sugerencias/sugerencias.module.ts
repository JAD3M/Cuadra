import { Module } from '@nestjs/common';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { PersistenciaSugerencias } from './persistencia-sugerencias';
import {
  ProveedorDesactivado,
  ProveedorSugerencia,
} from './proveedor-sugerencia';
import {
  OPCIONES_POR_OMISION,
  OPCIONES_SUGERENCIAS,
  SugerenciasService,
} from './sugerencias.service';

/**
 * CU-17. Sin proveedor real todavía: el puerto queda enlazado al desactivado,
 * así que el servicio no llama a nadie. `TransaccionEmpresa` viene del módulo
 * global de contexto de empresa y la tolerancia de `ConciliacionModule`.
 */
@Module({
  imports: [ConciliacionModule],
  providers: [
    SugerenciasService,
    PersistenciaSugerencias,
    { provide: ProveedorSugerencia, useClass: ProveedorDesactivado },
    { provide: OPCIONES_SUGERENCIAS, useValue: OPCIONES_POR_OMISION },
  ],
  exports: [SugerenciasService],
})
export class SugerenciasModule {}
