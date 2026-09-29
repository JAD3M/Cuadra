import { Injectable, Logger } from '@nestjs/common';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import {
  type CfdiAbierto,
  type MovimientoAbierto,
  type ParExistente,
  type Propuesta,
  seleccionarPropuestas,
} from './evaluar-par';
import { ProveedorTolerancia } from './tolerancia';

const TAMANO_LOTE = 500;

/**
 * Corre el motor de reglas (CU-11) sobre lo que una empresa tiene abierto y
 * guarda las propuestas. Solo escribe filas nuevas 'propuesta'/'regla': no
 * confirma nada ni toca movimientos, CFDI o conciliaciones existentes.
 */
@Injectable()
export class ConciliacionService {
  private readonly logger = new Logger(ConciliacionService.name);

  constructor(
    private readonly transaccion: TransaccionEmpresa,
    private readonly tolerancia: ProveedorTolerancia,
  ) {}

  /**
   * Idempotente. Corre en una sola transacción como `cuadra_app` (RLS), y
   * cada consulta filtra por `company_id` además de RLS. El candado
   * consultivo serializa las corridas de la misma empresa: la segunda espera
   * al commit de la primera y ve sus filas al leer.
   */
  async conciliar(companyId: string): Promise<{ propuestas: number }> {
    const propuestas = await this.transaccion.ejecutar(
      companyId,
      async (manager) => {
        await manager.query(
          `SELECT pg_advisory_xact_lock(hashtextextended('conciliar:' || $1::text, 0))`,
          [companyId],
        );

        const empresas = await manager.query<{ rfc: string }[]>(
          `SELECT rfc FROM companies WHERE id = $1`,
          [companyId],
        );
        if (empresas.length === 0) return 0;
        const { rfc } = empresas[0];

        const movimientos = await manager.query<MovimientoAbierto[]>(
          `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, monto::text AS monto,
                  moneda, referencia, referencia_norm AS "referenciaNorm"
             FROM movimientos
            WHERE company_id = $1 AND estado = 'abierto' AND monto > 0`,
          [companyId],
        );
        const cfdis = await manager.query<CfdiAbierto[]>(
          `SELECT id, serie, folio,
                  to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
                  total::text AS total, moneda
             FROM cfdi
            WHERE company_id = $1 AND estado = 'abierta'
              AND tipo_comprobante = 'I' AND rfc_emisor = $2`,
          [companyId, rfc],
        );
        const existentes = await manager.query<ParExistente[]>(
          `SELECT cfdi_id AS "cfdiId", movimiento_id AS "movimientoId",
                  (estado = 'rechazada') AS rechazada
             FROM conciliaciones WHERE company_id = $1`,
          [companyId],
        );

        const nuevas = seleccionarPropuestas(
          movimientos,
          cfdis,
          await this.tolerancia.obtener(companyId),
          existentes,
        );

        let insertadas = 0;
        for (let i = 0; i < nuevas.length; i += TAMANO_LOTE) {
          insertadas += await this.insertar(
            manager,
            companyId,
            nuevas.slice(i, i + TAMANO_LOTE),
          );
        }
        return insertadas;
      },
    );
    this.logger.log(`Empresa ${companyId}: ${propuestas} propuesta(s) nuevas`);
    return { propuestas };
  }

  private async insertar(
    manager: Parameters<Parameters<TransaccionEmpresa['ejecutar']>[1]>[0],
    companyId: string,
    lote: Propuesta[],
  ): Promise<number> {
    // Montos y scores viajan como texto JSON: nunca pasan por `number`.
    const filas = lote.map((p) => ({
      cfdi_id: p.cfdiId,
      movimiento_id: p.movimientoId,
      regla: p.regla,
      score: p.score.toFixed(4),
      diferencia_monto: p.diferenciaMonto,
      motivo: p.motivo,
    }));
    const creadas = await manager.query<{ id: string }[]>(
      `INSERT INTO conciliaciones
              (company_id, cfdi_id, movimiento_id, estado, origen, regla,
               score, diferencia_monto, motivo)
       SELECT $1, x.cfdi_id, x.movimiento_id, 'propuesta', 'regla', x.regla,
              x.score, x.diferencia_monto, x.motivo
         FROM jsonb_to_recordset($2::jsonb)
           AS x(cfdi_id uuid, movimiento_id uuid, regla text, score numeric,
                diferencia_monto numeric, motivo text)
       ON CONFLICT (company_id, cfdi_id, movimiento_id) DO NOTHING
       RETURNING id`,
      [companyId, JSON.stringify(filas)],
    );
    return creadas.length;
  }
}
