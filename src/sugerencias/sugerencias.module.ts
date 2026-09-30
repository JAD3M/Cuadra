import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { AdaptadorAnthropic } from './adaptador-anthropic';
import { COLA_SUGERENCIAS, ColaSugerencias } from './cola-sugerencias';
import { PersistenciaSugerencias } from './persistencia-sugerencias';
import { ProcesadorSugerencias } from './procesador-sugerencias';
import {
  ProveedorDesactivado,
  ProveedorSugerencia,
} from './proveedor-sugerencia';
import {
  OPCIONES_SUGERENCIAS,
  type OpcionesSugerencias,
  SugerenciasService,
} from './sugerencias.service';

/**
 * CU-17. El proveedor real solo se enlaza con LLM_HABILITADO='true' Y una
 * llave. Habilitado sin llave es una mala configuración, no un fallo de
 * arranque: queda inerte y avisa una vez, para que el CI y los entornos sin
 * secreto sigan arrancando.
 */
export function crearProveedor(config: ConfigService): ProveedorSugerencia {
  if (!config.get<boolean>('LLM_HABILITADO')) return new ProveedorDesactivado();
  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  if (!apiKey) {
    new Logger('SugerenciasModule').warn(
      'LLM_HABILITADO=true pero falta ANTHROPIC_API_KEY: la sugerencia por IA queda desactivada',
    );
    return new ProveedorDesactivado();
  }
  return new AdaptadorAnthropic({
    apiKey,
    modelo: config.getOrThrow<string>('LLM_MODEL'),
    timeoutMs: config.getOrThrow<number>('LLM_TIMEOUT_MS'),
  });
}

@Module({
  imports: [
    ConciliacionModule,
    BullModule.registerQueue({
      name: COLA_SUGERENCIAS,
      defaultJobOptions: {
        // Sin reintentos: el siguiente disparo vuelve a preguntar solo lo
        // que falte, y reintentar un job multiplicaría llamadas de pago.
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    }),
  ],
  providers: [
    SugerenciasService,
    PersistenciaSugerencias,
    ColaSugerencias,
    ProcesadorSugerencias,
    {
      provide: ProveedorSugerencia,
      inject: [ConfigService],
      useFactory: crearProveedor,
    },
    {
      provide: OPCIONES_SUGERENCIAS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OpcionesSugerencias => ({
        maxLlamadas: config.getOrThrow<number>('LLM_MAX_LLAMADAS_POR_CORRIDA'),
        maxCandidatos: config.getOrThrow<number>('LLM_CANDIDATOS_MAX'),
      }),
    },
  ],
  exports: [SugerenciasService, ColaSugerencias],
})
export class SugerenciasModule {}
