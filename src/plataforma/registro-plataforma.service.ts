import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AccionBitacoraPlataforma } from '../common/entities/tipos';
import { BitacoraPlataforma } from './bitacora-plataforma.entity';

export interface EventoPlataforma {
  accion: AccionBitacoraPlataforma;
  /** Nulo cuando no hay cuenta de plataforma autenticada (p. ej. una sesión de empresa). */
  plataformaUsuarioId?: string | null;
  /** Informativo: la empresa a la que apuntaba el intento, si la había. */
  companyId?: string | null;
  /** Nunca tokens ni contraseñas. */
  detalle: Record<string, unknown>;
}

/**
 * AD-7. Única puerta de escritura a `bitacora_plataforma` (clase 3: solo este
 * módulo nombra la tabla). `cuadra_app` solo puede agregar filas.
 *
 * Nunca lanza: si la bitácora falla, la petición sigue su camino (un 403 sigue
 * siendo 403) y el error queda en el log. Mismo contrato que `AccesosDenegados`.
 */
@Injectable()
export class RegistroPlataforma {
  private readonly logger = new Logger(RegistroPlataforma.name);

  constructor(
    @InjectRepository(BitacoraPlataforma)
    private readonly repositorio: Repository<BitacoraPlataforma>,
  ) {}

  async registrar(evento: EventoPlataforma): Promise<void> {
    try {
      // `save` de una fila nueva es un INSERT: no pide UPDATE, que no tiene.
      await this.repositorio.save(
        this.repositorio.create({
          accion: evento.accion,
          plataformaUsuarioId: evento.plataformaUsuarioId ?? null,
          companyId: evento.companyId ?? null,
          detalle: evento.detalle,
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar ${evento.accion} en bitacora_plataforma`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
