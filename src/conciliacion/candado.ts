import type { EntityManager } from 'typeorm';

/**
 * Candado consultivo por empresa: serializa `conciliar()` y las acciones de
 * resolución (CU-15). Se toma siempre primero, antes de cualquier fila, para
 * que todos los que lo usan bloqueen en el mismo orden y no haya deadlock.
 * Se libera solo al terminar la transacción.
 */
export async function tomarCandadoDeConciliacion(
  manager: Pick<EntityManager, 'query'>,
  companyId: string,
): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtextextended('conciliar:' || $1::text, 0))`,
    [companyId],
  );
}
