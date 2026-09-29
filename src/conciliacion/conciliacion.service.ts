import { Injectable, Logger } from '@nestjs/common';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { tomarCandadoDeConciliacion } from './candado';
import {
  type CfdiAbierto,
  evaluarConMotivos,
  type MovimientoAbierto,
  type ParExistente,
  type Propuesta,
  type SinMatch,
} from './evaluar-par';
import { ProveedorTolerancia } from './tolerancia';

const TAMANO_LOTE = 500;

type Manager = Parameters<Parameters<TransaccionEmpresa['ejecutar']>[1]>[0];

/** Vigente = propuesta o confirmada; la rechazada ya no cuenta. */
const CONCILIACION_VIGENTE = `EXISTS (SELECT 1 FROM conciliaciones c
                  WHERE c.company_id = $1 AND c.movimiento_id = m.id
                    AND c.estado <> 'rechazada')`;

/**
 * Corre el motor de reglas (CU-11) sobre lo que una empresa tiene abierto,
 * guarda las propuestas y, para cada movimiento sin propuesta, el motivo
 * (CU-13). Solo escribe filas nuevas 'propuesta'/'regla' y las columnas de
 * motivo de movimientos abiertos: nunca cambia `estado` ni toca CFDI.
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
    const { propuestas, sinMatch } = await this.transaccion.ejecutar(
      companyId,
      async (manager) => {
        await tomarCandadoDeConciliacion(manager, companyId);

        const empresas = await manager.query<{ rfc: string }[]>(
          `SELECT rfc FROM companies WHERE id = $1`,
          [companyId],
        );
        if (empresas.length === 0) return { propuestas: 0, sinMatch: 0 };
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

        const { propuestas: nuevas, sinMatch: sinPropuesta } =
          evaluarConMotivos(
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

        // Después de insertar: el NOT EXISTS ve las propuestas de esta corrida.
        let motivos = 0;
        for (let i = 0; i < sinPropuesta.length; i += TAMANO_LOTE) {
          motivos += await this.guardarMotivos(
            manager,
            companyId,
            sinPropuesta.slice(i, i + TAMANO_LOTE),
          );
        }
        await this.limpiarMotivos(manager, companyId);
        return { propuestas: insertadas, sinMatch: motivos };
      },
    );
    this.logger.log(
      `Empresa ${companyId}: ${propuestas} propuesta(s) nuevas, ${sinMatch} motivo(s) sin coincidencia escritos`,
    );
    return { propuestas };
  }

  /**
   * Escribe solo si el resultado cambió (IS DISTINCT FROM): re-correr con los
   * mismos datos no reescribe filas y `evaluado_at` conserva su valor. Solo
   * toca abiertos sin conciliación vigente; jamás `estado`.
   */
  private async guardarMotivos(
    manager: Manager,
    companyId: string,
    lote: SinMatch[],
  ): Promise<number> {
    const filas = lote.map((s) => ({
      id: s.movimientoId,
      regla: s.regla,
      motivo: s.motivo,
    }));
    const escritos = await manager.query<{ id: string }[]>(
      `UPDATE movimientos m
          SET motivo_sin_match = x.motivo, regla_sin_match = x.regla,
              evaluado_at = clock_timestamp()
         FROM jsonb_to_recordset($2::jsonb) AS x(id uuid, regla text, motivo text)
        WHERE m.company_id = $1 AND m.id = x.id AND m.estado = 'abierto'
          AND m.monto > 0
          AND NOT ${CONCILIACION_VIGENTE}
          AND (m.motivo_sin_match IS DISTINCT FROM x.motivo
               OR m.regla_sin_match IS DISTINCT FROM x.regla
               OR m.evaluado_at IS NULL)
       RETURNING m.id`,
      [companyId, JSON.stringify(filas)],
    );
    return escritos.length;
  }

  /**
   * Un motivo nunca convive con una propuesta vigente: si un movimiento abierto
   * tiene conciliación vigente (de esta corrida o de una anterior), se limpia.
   * Se decide con la base, no con la lista del motor.
   */
  private async limpiarMotivos(
    manager: Manager,
    companyId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE movimientos m
          SET motivo_sin_match = NULL, regla_sin_match = NULL, evaluado_at = NULL
        WHERE m.company_id = $1 AND m.estado = 'abierto' AND m.monto > 0
          AND ${CONCILIACION_VIGENTE}
          AND (m.motivo_sin_match IS NOT NULL OR m.regla_sin_match IS NOT NULL
               OR m.evaluado_at IS NOT NULL)`,
      [companyId],
    );
  }

  private async insertar(
    manager: Manager,
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
