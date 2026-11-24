import type { DataSource } from 'typeorm';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { MuestrasService, type ResultadoMuestra } from './muestras.service';

/**
 * Sortear la muestra de verificación a mano, para desarrollo y demo (9.3, 9.4).
 * El programador mensual solo sortea el día 1 y para el mes anterior; este
 * comando reutiliza `MuestrasService.generar`, así que conserva su candado de
 * empresa y su garantía: la muestra se guarda al sortearse y no se re-sortea.
 * No pasa por HTTP ni por la cola.
 */

const USO = 'Uso: npm run sortear:muestra -- AAAA-MM [--empresa=RFC]';
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface OpcionesDeSorteo {
  /** `AAAA-MM`, mes calendario en UTC. */
  mes: string;
  /** RFC de una sola empresa; sin él, todas las activas. */
  rfc?: string;
}

export interface ResultadoDeSorteo {
  companyId: string;
  rfc: string;
  estado: ResultadoMuestra['estado'];
  /** Primer día del mes, `YYYY-MM-DD`. */
  mes: string;
  casos: number;
}

/** Lee `AAAA-MM` y, si viene, `--empresa=RFC`; cualquier otra cosa explica el uso. */
export function leerArgumentosDeSorteo(
  argv: readonly string[],
): OpcionesDeSorteo {
  const [mes, ...resto] = argv;
  if (!mes || !MES.test(mes) || resto.length > 1) throw new Error(USO);
  let rfc: string | undefined;
  if (resto.length === 1) {
    const [bandera, valor] = resto[0].split('=');
    if (bandera !== '--empresa' || !valor) throw new Error(USO);
    rfc = valor.trim().toUpperCase();
  }
  return { mes, rfc };
}

export async function sortearMuestra(
  ds: DataSource,
  { mes, rfc }: OpcionesDeSorteo,
): Promise<ResultadoDeSorteo[]> {
  if (!MES.test(mes)) {
    throw new Error(`El mes debe ser AAAA-MM; llegó "${mes}".`);
  }
  // `companies` es la raíz del aislamiento (clase 2): no lleva `company_id`.
  const empresas = await ds.query<{ id: string; rfc: string }[]>(
    `SELECT id, rfc FROM companies
      WHERE activa = true AND ($1::text IS NULL OR rfc = $1)
      ORDER BY id`,
    [rfc ?? null],
  );
  if (rfc && empresas.length === 0) {
    throw new Error(`No hay una empresa activa con RFC ${rfc}.`);
  }

  const servicio = new MuestrasService(new TransaccionEmpresa(ds));
  const resultados: ResultadoDeSorteo[] = [];
  for (const empresa of empresas) {
    const r = await servicio.generar(empresa.id, mes);
    resultados.push({
      companyId: empresa.id,
      rfc: empresa.rfc,
      estado: r.estado,
      mes: r.mes,
      casos: r.decisionIds.length,
    });
  }
  return resultados;
}
