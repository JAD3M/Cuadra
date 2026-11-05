import { Injectable, Logger } from '@nestjs/common';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { tomarCandadoDeConciliacion } from './candado';
import {
  proponerGrupos,
  type PropuestaGrupoDeMovimiento,
} from './evaluar-grupo';
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

/**
 * Ocupado = decisión propuesta o confirmada; la rechazada y la obsoleta ya no
 * ocupan el movimiento (AD-4).
 */
const CONCILIACION_VIGENTE = `EXISTS (SELECT 1 FROM decisiones c
                  WHERE c.company_id = $1 AND c.movimiento_id = m.id
                    AND c.estado IN ('propuesta', 'confirmada'))`;

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
                  total::text AS total, moneda,
                  rfc_receptor AS "rfcReceptor"
             FROM cfdi
            WHERE company_id = $1 AND estado = 'abierta'
              AND tipo_comprobante = 'I' AND rfc_emisor = $2`,
          [companyId, rfc],
        );
        const existentes = await manager.query<ParExistente[]>(
          `SELECT l.cfdi_id AS "cfdiId", d.movimiento_id AS "movimientoId",
                  (d.estado = 'rechazada') AS rechazada
             FROM decisiones d
             JOIN decision_lineas l
               ON l.decision_id = d.id AND l.company_id = d.company_id
            WHERE d.company_id = $1
              AND d.estado IN ('propuesta', 'confirmada', 'rechazada')`,
          [companyId],
        );

        const tolerancia = await this.tolerancia.obtener(companyId);
        const { propuestas: nuevas, sinMatch: sinPorFactura } =
          evaluarConMotivos(movimientos, cfdis, tolerancia, existentes);

        // Historia 4.5: la búsqueda de grupos solo corre donde las reglas de
        // una factura no encontraron nada (ni referencia ni monto).
        const sinCandidato = new Set(
          sinPorFactura
            .filter((s) => s.regla === 'sin_candidato_monto')
            .map((s) => s.movimientoId),
        );
        const grupos = proponerGrupos(
          movimientos.filter((m) => sinCandidato.has(m.id)),
          cfdis,
          tolerancia,
          existentes,
          await this.huellasRechazadas(manager, companyId),
          new Set(nuevas.map((p) => p.cfdiId)),
        );
        const sustituidos = new Set([
          ...grupos.propuestas.map((p) => p.movimientoId),
          ...grupos.sinMatch.map((s) => s.movimientoId),
        ]);
        const sinPropuesta = [
          ...sinPorFactura.filter((s) => !sustituidos.has(s.movimientoId)),
          ...grupos.sinMatch,
        ];

        let insertadas = 0;
        for (let i = 0; i < nuevas.length; i += TAMANO_LOTE) {
          insertadas += await this.insertar(
            manager,
            companyId,
            nuevas.slice(i, i + TAMANO_LOTE),
          );
        }
        for (let i = 0; i < grupos.propuestas.length; i += TAMANO_LOTE) {
          insertadas += await this.insertarGrupos(
            manager,
            companyId,
            grupos.propuestas.slice(i, i + TAMANO_LOTE),
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

  /** Huellas de los conjuntos ya rechazados, por movimiento (4.5). */
  private async huellasRechazadas(
    manager: Manager,
    companyId: string,
  ): Promise<Map<string, Set<string>>> {
    const filas = await manager.query<
      { movimientoId: string; huella: string }[]
    >(
      `SELECT movimiento_id AS "movimientoId", huella_conjunto AS huella
         FROM decisiones
        WHERE company_id = $1 AND estado = 'rechazada'
          AND huella_conjunto IS NOT NULL`,
      [companyId],
    );
    const porMovimiento = new Map<string, Set<string>>();
    for (const f of filas) {
      const set = porMovimiento.get(f.movimientoId) ?? new Set<string>();
      set.add(f.huella);
      porMovimiento.set(f.movimientoId, set);
    }
    return porMovimiento;
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

  /**
   * Escribe las propuestas nuevas y su fila `crear` en la bitácora en UNA sola
   * sentencia (CTE con INSERT): o quedan las dos cosas o ninguna, y los pares
   * que ON CONFLICT descarta no salen de RETURNING, así que re-correr no
   * audita nada. Corre dentro del candado advisory y de la transacción de la
   * corrida. El autor es el sistema (`user_id` NULL).
   */
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
    const auditadas = await manager.query<{ id: string }[]>(
      `WITH fuente AS (
         SELECT uuidv7() AS id, x.cfdi_id, x.movimiento_id, x.regla,
                x.score, x.diferencia_monto, x.motivo
           FROM jsonb_to_recordset($2::jsonb)
             AS x(cfdi_id uuid, movimiento_id uuid, regla text, score numeric,
                  diferencia_monto numeric, motivo text)
       ),
       cabeceras AS (
         INSERT INTO decisiones
                (id, company_id, movimiento_id, tipo, estado, origen, regla,
                 score, diferencia_monto, motivo, requiere_revision,
                 huella_conjunto)
         SELECT f.id, $1, f.movimiento_id, 'conciliacion', 'propuesta', 'regla',
                f.regla, f.score, f.diferencia_monto, f.motivo, false,
                huella_conjunto(ARRAY[f.cfdi_id])
           FROM fuente f
         ON CONFLICT DO NOTHING
         RETURNING id, movimiento_id, regla, score, diferencia_monto
       ),
       lineas AS (
         INSERT INTO decision_lineas
                (company_id, decision_id, estado_decision, cfdi_id)
         SELECT $1, f.id, 'propuesta', f.cfdi_id
           FROM fuente f
           JOIN cabeceras c ON c.id = f.id
         RETURNING decision_id
       )
       INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
       SELECT $1, NULL, 'decisiones', c.id, 'crear',
              jsonb_build_object(
                'despues', jsonb_build_object('estado', 'propuesta'),
                'origen', 'regla',
                'regla', c.regla,
                'score', c.score::text,
                'diferenciaMonto', c.diferencia_monto::text,
                'cfdiId', f.cfdi_id,
                'movimientoId', c.movimiento_id)
         FROM cabeceras c
         JOIN fuente f ON f.id = c.id
       RETURNING id`,
      [companyId, JSON.stringify(filas)],
    );
    return auditadas.length;
  }

  /**
   * Propuestas de grupo (4.5): una decisión con una línea por factura y su fila
   * `crear` en la bitácora, en UNA sentencia. Misma disciplina que `insertar`;
   * la huella cubre todas las facturas y el índice único por huella abierta
   * (ON CONFLICT DO NOTHING) es el respaldo ante una corrida repetida.
   */
  private async insertarGrupos(
    manager: Manager,
    companyId: string,
    lote: PropuestaGrupoDeMovimiento[],
  ): Promise<number> {
    const filas = lote.map((p) => ({
      movimiento_id: p.movimientoId,
      cfdi_ids: p.cfdiIds,
      regla: p.regla,
      score: p.score.toFixed(4),
      diferencia_monto: p.diferenciaMonto,
      motivo: p.motivo,
    }));
    const auditadas = await manager.query<{ id: string }[]>(
      `WITH fuente AS (
         SELECT uuidv7() AS id, x.movimiento_id, x.cfdi_ids, x.regla,
                x.score, x.diferencia_monto, x.motivo
           FROM jsonb_to_recordset($2::jsonb)
             AS x(movimiento_id uuid, cfdi_ids jsonb, regla text, score numeric,
                  diferencia_monto numeric, motivo text)
       ),
       cabeceras AS (
         INSERT INTO decisiones
                (id, company_id, movimiento_id, tipo, estado, origen, regla,
                 score, diferencia_monto, motivo, requiere_revision,
                 huella_conjunto)
         SELECT f.id, $1, f.movimiento_id, 'conciliacion', 'propuesta', 'regla',
                f.regla, f.score, f.diferencia_monto, f.motivo, false,
                huella_conjunto(ARRAY(
                  SELECT e::uuid FROM jsonb_array_elements_text(f.cfdi_ids) e))
           FROM fuente f
         ON CONFLICT DO NOTHING
         RETURNING id, movimiento_id, regla, score, diferencia_monto
       ),
       lineas AS (
         INSERT INTO decision_lineas
                (company_id, decision_id, estado_decision, cfdi_id)
         SELECT $1, f.id, 'propuesta', e::uuid
           FROM fuente f
           JOIN cabeceras c ON c.id = f.id
          CROSS JOIN LATERAL jsonb_array_elements_text(f.cfdi_ids) e
         RETURNING decision_id
       )
       INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
       SELECT $1, NULL, 'decisiones', c.id, 'crear',
              jsonb_build_object(
                'despues', jsonb_build_object('estado', 'propuesta'),
                'origen', 'regla',
                'regla', c.regla,
                'score', c.score::text,
                'diferenciaMonto', c.diferencia_monto::text,
                'cfdiIds', f.cfdi_ids,
                'movimientoId', c.movimiento_id)
         FROM cabeceras c
         JOIN fuente f ON f.id = c.id
       RETURNING id`,
      [companyId, JSON.stringify(filas)],
    );
    return auditadas.length;
  }
}
