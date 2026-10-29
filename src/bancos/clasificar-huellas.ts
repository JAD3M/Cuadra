import type { EntityManager } from 'typeorm';
import {
  huellaMovimiento,
  mismaReferenciaCruda,
  type EntradaHuella,
} from './huella-movimiento';

/**
 * Historia 3.5 (FR-65). Qué es una fila entrante frente a lo que ya hay en
 * `movimientos` (en cualquier estado):
 * - exacto: misma huella y misma referencia cruda; ya existe, se omite.
 * - dudoso: misma huella pero referencia cruda distinta; entra como
 *   `pendiente_revision`.
 * - nuevo: sin pareja; entra como `abierto`.
 */
export type ClaseDeHuella = 'exacto' | 'dudoso' | 'nuevo';

export interface HuellaConReferencia {
  huella: string;
  /** La referencia cruda, tal como llegó o como se guardó. */
  referencia: string | null;
}

/**
 * Núcleo puro. Empareja UNO A UNO dentro de cada grupo de huella:
 *  1. cada entrante, en orden, consume el primer existente libre con la misma
 *     referencia cruda (exacto);
 *  2. los entrantes que quedaron sin pareja toman, en orden, un existente que
 *     sobre del mismo grupo (dudoso);
 *  3. el resto es nuevo.
 * Por eso con 1 en la base y 2 iguales en el archivo: 1 exacto y 1 nuevo.
 * Los entrantes nunca se emparejan entre sí, solo contra `existentes`.
 * Devuelve una clase por entrante, en el orden de entrada.
 */
export function emparejar(
  entrantes: readonly HuellaConReferencia[],
  existentes: readonly HuellaConReferencia[],
): ClaseDeHuella[] {
  const libres = new Map<string, Array<string | null>>();
  for (const { huella, referencia } of existentes) {
    const grupo = libres.get(huella);
    if (grupo) grupo.push(referencia);
    else libres.set(huella, [referencia]);
  }
  const clases: ClaseDeHuella[] = entrantes.map(() => 'nuevo');
  const sinPareja: number[] = [];
  entrantes.forEach(({ huella, referencia }, i) => {
    const grupo = libres.get(huella);
    const j =
      grupo?.findIndex((r) => mismaReferenciaCruda(r, referencia)) ?? -1;
    if (grupo && j >= 0) {
      grupo.splice(j, 1);
      clases[i] = 'exacto';
    } else if (grupo && grupo.length > 0) {
      sinPareja.push(i);
    }
  });
  for (const i of sinPareja) {
    const grupo = libres.get(entrantes[i].huella);
    if (grupo && grupo.length > 0) {
      grupo.shift();
      clases[i] = 'dudoso';
    }
  }
  return clases;
}

/**
 * Clasifica un lote contra `movimientos` de la empresa con UNA consulta. Debe
 * llamarse con el candado de empresa ya tomado (`tomarCandadoDeConciliacion`),
 * en la misma transacción que inserta: así dos cargas simultáneas no se ven a
 * medias. Devuelve una clase por fila, en el orden de entrada.
 */
export async function clasificarPorHuella(
  manager: Pick<EntityManager, 'query'>,
  companyId: string,
  filas: readonly EntradaHuella[],
): Promise<ClaseDeHuella[]> {
  if (filas.length === 0) return [];
  const entrantes = filas.map((f) => ({
    huella: huellaMovimiento(f),
    referencia: f.referencia ?? null,
  }));
  const huellas = [...new Set(entrantes.map((f) => f.huella))];
  const existentes = await manager.query<HuellaConReferencia[]>(
    `SELECT huella, referencia FROM movimientos
      WHERE company_id = $1 AND huella = ANY($2::text[])
      ORDER BY created_at, id`,
    [companyId, huellas],
  );
  return emparejar(entrantes, existentes);
}
