import { Injectable, Logger } from '@nestjs/common';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '../conciliacion/evaluar-par';
import { TransaccionEmpresa } from '../database/transaccion-empresa';

/** Fracción de las confirmaciones en lote que se verifica, y su mínimo (FR-63). */
export const PORCENTAJE_MUESTRA = 5;
export const MINIMO_MUESTRA = 20;

export interface ResultadoMuestra {
  /**
   * `generada`: se sorteó ahora. `existente`: ya estaba guardada y se devuelve
   * igual. `sin_casos`: no hubo confirmaciones en lote y no se creó nada.
   */
  estado: 'generada' | 'existente' | 'sin_casos';
  /** Primer día del mes, `YYYY-MM-DD`. */
  mes: string;
  decisionIds: string[];
}

/** 5 % hacia arriba, al menos 20, y nunca más de las que hay. */
export function tamanoDeMuestra(elegibles: number): number {
  return Math.min(
    elegibles,
    Math.max(MINIMO_MUESTRA, Math.ceil((elegibles * PORCENTAJE_MUESTRA) / 100)),
  );
}

/**
 * Historia 9.3 (FR-63, AD-10, AD-19). Sortea cada mes, por empresa, qué
 * confirmaciones en lote de la regla 1 verificará una persona (9.4). La muestra
 * se guarda al generarse y no se re-sortea: una segunda corrida del mismo mes
 * devuelve las filas guardadas. Toma el candado de empresa, así que se
 * serializa con las confirmaciones y reaperturas.
 */
@Injectable()
export class MuestrasService {
  private readonly logger = new Logger(MuestrasService.name);

  constructor(private readonly transaccion: TransaccionEmpresa) {}

  /** `mes` es `AAAA-MM`; el mes es el calendario en UTC. */
  async generar(companyId: string, mes: string): Promise<ResultadoMuestra> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      throw new Error(`El mes debe ser AAAA-MM; llegó "${mes}".`);
    }
    const primerDia = `${mes}-01`;

    const resultado = await this.transaccion.ejecutar(
      companyId,
      async (manager) => {
        await tomarCandadoDeConciliacion(manager, companyId);

        const guardadas = await manager.query<{ decision_id: string }[]>(
          `SELECT decision_id FROM muestras_verificacion
            WHERE company_id = $1 AND mes = $2::date AND resultado IS NULL
            ORDER BY decision_id`,
          [companyId, primerDia],
        );
        if (guardadas.length > 0) {
          return {
            estado: 'existente' as const,
            mes: primerDia,
            decisionIds: guardadas.map((f) => f.decision_id),
          };
        }

        const elegibles = `
          FROM decisiones d
         WHERE d.company_id = $1
           AND d.estado = 'confirmada'
           AND d.regla = $3
           AND d.lote_id IS NOT NULL
           AND d.confirmada_at >= ($2::date)::timestamp AT TIME ZONE 'UTC'
           AND d.confirmada_at < (($2::date + interval '1 month')::timestamp AT TIME ZONE 'UTC')`;
        const [{ n }] = await manager.query<{ n: number }[]>(
          `SELECT count(*)::int AS n ${elegibles}`,
          [companyId, primerDia, REGLA_REFERENCIA_MONTO_EXACTO],
        );
        if (n === 0) {
          return {
            estado: 'sin_casos' as const,
            mes: primerDia,
            decisionIds: [],
          };
        }

        const elegidas = await manager.query<{ decision_id: string }[]>(
          `INSERT INTO muestras_verificacion (company_id, mes, decision_id)
           SELECT $1, $2::date, d.id ${elegibles}
            ORDER BY random()
            LIMIT $4
           RETURNING decision_id`,
          [
            companyId,
            primerDia,
            REGLA_REFERENCIA_MONTO_EXACTO,
            tamanoDeMuestra(n),
          ],
        );
        return {
          estado: 'generada' as const,
          mes: primerDia,
          decisionIds: elegidas.map((f) => f.decision_id),
        };
      },
    );

    if (resultado.estado === 'sin_casos') {
      this.logger.log(
        `Muestra ${mes} de la empresa ${companyId}: no hubo confirmaciones en lote de la regla 1, no se creó muestra.`,
      );
    }
    return resultado;
  }
}
