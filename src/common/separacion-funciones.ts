import type { EntityManager } from 'typeorm';

/**
 * D-08: quien subió la carga del CFDI o la del movimiento no confirma su propio
 * trabajo. Es UNA sola definición de la regla: la confirmación individual y la
 * bandeja (que marca qué filas no puede confirmar la persona) la usan. Una
 * carga nula (sin carga) no restringe.
 *
 * `empresa`, `persona` y `cargas` son expresiones SQL (por ejemplo `$1`, `$6` y
 * un arreglo de uuid); nunca texto de la persona.
 */
export function sqlSubioAlgunaCarga(
  empresa: string,
  persona: string,
  cargas: string,
): string {
  return `EXISTS (SELECT 1 FROM cargas c
                   WHERE c.company_id = ${empresa}
                     AND c.subido_por_id = ${persona}
                     AND c.id = ANY(${cargas}))`;
}

/**
 * Versión que no lanza ni escribe nada: responde si la persona subió alguna de
 * esas cargas. Quien decide qué hacer (403 con rastro, omitir en un lote) es
 * quien llama.
 */
export async function subioAlgunaCarga(
  manager: EntityManager,
  companyId: string,
  userId: string,
  cargaIds: ReadonlyArray<string | null>,
): Promise<boolean> {
  const cargas = cargaIds.filter((c): c is string => c !== null);
  if (cargas.length === 0) return false;
  const [fila] = await manager.query<{ subio: boolean }[]>(
    `SELECT ${sqlSubioAlgunaCarga('$1', '$2', '$3::uuid[]')} AS subio`,
    [companyId, userId, cargas],
  );
  return fila?.subio === true;
}
