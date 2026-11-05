import { type Consultable, una } from '../database/testing/base-de-pruebas';
import type { EstadoDecision } from '../common/entities/tipos';
import { huellaConjunto } from './huella-conjunto';

/**
 * Siembra para los specs (historia 4.2): una decisión de tipo 'conciliacion'
 * con una línea por factura (una sola salvo `cfdiIds`). Solo para pruebas: el código de la aplicación nunca
 * importa este archivo.
 */
export interface DecisionSembrada {
  companyId: string;
  movimientoId: string;
  /** Una factura; ignorado si se da `cfdiIds`. */
  cfdiId?: string;
  /** Un grupo (4.5): una línea por factura, misma huella de conjunto. */
  cfdiIds?: string[];
  estado: EstadoDecision;
  /** Por omisión 'manual'. */
  origen?: 'regla' | 'llm' | 'manual';
  regla?: string | null;
  /** Texto con 4 decimales, p. ej. '1.0000'. */
  score?: string | null;
  diferenciaMonto?: string | null;
  /** Obligatorios (con la fecha) si el estado es 'confirmada'. */
  confirmadaPorId?: string | null;
  confirmadaAt?: Date | null;
  motivo?: string | null;
}

/**
 * Inserta cabecera y línea. La huella sale del espejo TS de `huella_conjunto`.
 * Si el estado es 'confirmada' y no se da fecha, usa `new Date()`; la persona
 * sí es obligatoria (lo exige el CHECK de AD-3). Devuelve el id de la decisión.
 */
export async function sembrarDecision(
  origen: Consultable,
  d: DecisionSembrada,
): Promise<string> {
  const confirmada = d.estado === 'confirmada';
  const cfdiIds = d.cfdiIds ?? (d.cfdiId ? [d.cfdiId] : []);
  if (cfdiIds.length === 0) throw new Error('sembrarDecision: falta cfdiId');
  const { id } = await una<{ id: string }>(
    origen,
    `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen,
                             regla, score, diferencia_monto, huella_conjunto,
                             confirmada_por_id, confirmada_at, motivo)
     VALUES ($1, $2, 'conciliacion', $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      d.companyId,
      d.movimientoId,
      d.estado,
      d.origen ?? 'manual',
      d.regla ?? null,
      d.score ?? null,
      d.diferenciaMonto ?? null,
      huellaConjunto(cfdiIds),
      d.confirmadaPorId ?? null,
      d.confirmadaAt ?? (confirmada ? new Date() : null),
      d.motivo ?? null,
    ],
  );
  for (const cfdiId of cfdiIds) {
    await origen.query(
      `INSERT INTO decision_lineas (company_id, decision_id, estado_decision, cfdi_id)
       VALUES ($1, $2, $3, $4)`,
      [d.companyId, id, d.estado, cfdiId],
    );
  }
  return id;
}
