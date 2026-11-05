import { ConflictException } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import type { EstadoCfdi } from '../common/entities/tipos';

/** Motivo con el que queda una propuesta viva cuando su CFDI se cancela. */
export const MOTIVO_CFDI_CANCELADO =
  'El CFDI fue cancelado: la propuesta ya no es válida';

export interface ResultadoDeCancelacion {
  /**
   * `cancelada`: la transición se aplicó. `ya_cancelada`: ya lo estaba y no
   * cambió nada (idempotente). `no_existe`: el id no es de esta empresa.
   */
  resultado: 'cancelada' | 'ya_cancelada' | 'no_existe';
  /** Estado del CFDI antes de la transición; ausente si no existe. */
  antes?: EstadoCfdi;
  /** Propuestas vivas que pasaron a `obsoleta` (grupos enteras). */
  decisionesObsoletas: string[];
  /** Decisiones `confirmada` que quedaron con `requiere_revision`. */
  decisionesPorRevisar: string[];
}

interface Fila {
  antes: EstadoCfdi | null;
  cancelados: number;
  obsoletas: string[] | null;
  porRevisar: string[] | null;
  auditoria: number;
}

/**
 * Historia 4.6 (AC1, AC3, AC4; AD-7, AD-19). Un CFDI abierta, parcialidades o
 * conciliada pasa a `cancelada`, en UNA sentencia que también:
 *  - deja `obsoleta` toda propuesta viva con una línea de ese CFDI (en un
 *    grupo, la decisión entera: no puede seguir viva con una línea cancelada);
 *  - marca `requiere_revision` en las decisiones `confirmada` que lo incluyen,
 *    sin cambiarles el estado: Cuadra nunca reabre sola una decisión
 *    confirmada, y `movimientos.estado` no se toca;
 *  - escribe su bitácora (`actualizar` sobre `cfdi`).
 * No consulta al SAT. Rechazadas y obsoletas no se tocan. Una ya `cancelada`
 * no cambia nada (idempotente, sin bitácora).
 *
 * Orden de candados (AD-19): candado de empresa, decisiones por `id`
 * ascendente, el CFDI. Debe llamarse dentro de la transacción de la empresa
 * (RLS) y con `quien` = la persona que subió el archivo, o null.
 */
export async function cancelarCfdi(
  manager: EntityManager,
  companyId: string,
  cfdiId: string,
  quien: string | null,
): Promise<ResultadoDeCancelacion> {
  await tomarCandadoDeConciliacion(manager, companyId);
  await manager.query(
    `SELECT d.id FROM decisiones d
      WHERE d.company_id = $1
        AND EXISTS (SELECT 1 FROM decision_lineas l
                     WHERE l.decision_id = d.id AND l.company_id = $1
                       AND l.cfdi_id = $2)
      ORDER BY d.id
        FOR UPDATE OF d`,
    [companyId, cfdiId],
  );
  await manager.query(
    `SELECT id FROM cfdi WHERE id = $1 AND company_id = $2 FOR UPDATE`,
    [cfdiId, companyId],
  );

  let fila: Fila;
  try {
    [fila] = await manager.query<Fila[]>(
      `WITH previo AS (
         SELECT estado FROM cfdi WHERE id = $2 AND company_id = $1
       ),
       cancelado AS (
         UPDATE cfdi SET estado = 'cancelada', updated_at = now()
          WHERE id = $2 AND company_id = $1 AND estado <> 'cancelada'
         RETURNING id
       ),
       obsoletas AS (
         UPDATE decisiones d
            SET estado = 'obsoleta', motivo = $4, updated_at = now()
          WHERE d.company_id = $1 AND d.estado = 'propuesta'
            AND EXISTS (SELECT 1 FROM cancelado)
            AND EXISTS (SELECT 1 FROM decision_lineas l
                         WHERE l.decision_id = d.id AND l.company_id = $1
                           AND l.cfdi_id = $2)
         RETURNING d.id
       ),
       por_revisar AS (
         UPDATE decisiones d
            SET requiere_revision = true, updated_at = now()
          WHERE d.company_id = $1 AND d.estado = 'confirmada'
            AND EXISTS (SELECT 1 FROM cancelado)
            AND EXISTS (SELECT 1 FROM decision_lineas l
                         WHERE l.decision_id = d.id AND l.company_id = $1
                           AND l.cfdi_id = $2)
         RETURNING d.id
       ),
       auditoria AS (
         INSERT INTO bitacora
                (company_id, user_id, entidad, entidad_id, accion, datos)
         SELECT $1::uuid, $3::uuid, 'cfdi', $2::uuid, 'actualizar',
                jsonb_build_object(
                  'antes', jsonb_build_object('estado', (SELECT estado FROM previo)),
                  'despues', jsonb_build_object('estado', 'cancelada'),
                  'decisionesObsoletas',
                    COALESCE((SELECT to_jsonb(array_agg(id ORDER BY id)) FROM obsoletas),
                             '[]'::jsonb),
                  'decisionesPorRevisar',
                    COALESCE((SELECT to_jsonb(array_agg(id ORDER BY id)) FROM por_revisar),
                             '[]'::jsonb))
          WHERE EXISTS (SELECT 1 FROM cancelado)
         RETURNING id
       )
       SELECT (SELECT estado FROM previo) AS antes,
              (SELECT count(*) FROM cancelado)::int AS cancelados,
              (SELECT array_agg(id ORDER BY id) FROM obsoletas) AS obsoletas,
              (SELECT array_agg(id ORDER BY id) FROM por_revisar) AS "porRevisar",
              (SELECT count(*) FROM auditoria)::int AS auditoria`,
      [companyId, cfdiId, quien, MOTIVO_CFDI_CANCELADO],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ConflictException(
        'La cancelación choca con otra operación en curso: reintenta',
      );
    }
    throw error;
  }

  if (fila.antes === null) {
    return {
      resultado: 'no_existe',
      decisionesObsoletas: [],
      decisionesPorRevisar: [],
    };
  }
  if (fila.cancelados === 0) {
    return {
      resultado: 'ya_cancelada',
      antes: fila.antes,
      decisionesObsoletas: [],
      decisionesPorRevisar: [],
    };
  }
  if (fila.cancelados !== 1 || fila.auditoria !== 1) {
    // Con los candados tomados no debe pasar; si pasa, nada se confirma.
    throw new ConflictException('La cancelación no quedó completa: reintenta');
  }
  return {
    resultado: 'cancelada',
    antes: fila.antes,
    decisionesObsoletas: fila.obsoletas ?? [],
    decisionesPorRevisar: fila.porRevisar ?? [],
  };
}
