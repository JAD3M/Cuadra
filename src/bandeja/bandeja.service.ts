import { Injectable } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { EstadoCfdi } from '../common/entities/tipos';
import {
  type ConsultaBandejaDto,
  type EstadoBandeja,
  ESTADOS_POR_DEFECTO,
  type CfdiResumenDto,
  type FilaBandejaDto,
  LIMITE_POR_DEFECTO,
  type RespuestaBandejaDto,
  type ResumenBandejaDto,
  ESTADOS_BANDEJA,
} from './dto/bandeja.dto';

/**
 * Movimiento con su mejor propuesta. Para un conciliado la lateral toma la
 * decisión 'confirmada'; para uno abierto, la 'propuesta' de mayor score
 * (empate: id menor). Rechazadas y obsoletas nunca casan. Una decisión puede
 * tener varias líneas (grupo, 4.5): la lateral va sobre la cabecera, sin unir
 * líneas, para que un grupo cuente como UNA propuesta y un solo caso; `n`
 * cuenta las propuestas antes del LIMIT 1. `cfdi_id` es la primera factura
 * (id ascendente); todas salen en `cfdis`.
 * Una confirmada con `requiere_revision` (4.6: su factura se canceló) se lista
 * junto a las sugerencias, aunque no se pida `conciliado`: sigue conciliada y
 * nunca se reabre sola, pero espera ojos humanos. Una normal no cambia.
 * Se comparte con el conteo para que `total` no dependa de la página.
 */
const DESDE_FILTRO = `
  FROM movimientos m
  LEFT JOIN LATERAL (
    SELECT d.id, d.score, d.diferencia_monto, d.regla, d.motivo,
           d.requiere_revision,
           (SELECT l.cfdi_id FROM decision_lineas l
             WHERE l.company_id = $1 AND l.decision_id = d.id
             ORDER BY l.cfdi_id LIMIT 1) AS cfdi_id,
           count(*) OVER() AS n
      FROM decisiones d
     WHERE d.company_id = $1
       AND d.movimiento_id = m.id
       AND d.tipo = 'conciliacion'
       AND d.estado = CASE WHEN m.estado = 'conciliado'
                           THEN 'confirmada' ELSE 'propuesta' END
     ORDER BY d.score DESC NULLS LAST, d.id
     LIMIT 1
  ) p ON true
  WHERE m.company_id = $1
    AND m.monto > 0
    AND (
      (m.estado = 'conciliado' AND ('conciliado' = ANY($2)
          OR (p.requiere_revision AND 'sugerencia' = ANY($2))))
      OR (m.estado = 'abierto' AND p.id IS NOT NULL AND 'sugerencia' = ANY($2))
      OR (m.estado = 'abierto' AND p.id IS NULL
          AND m.regla_sin_match IS NOT NULL AND 'sin_match' = ANY($2))
    )`;

/** Todas las facturas de la mejor propuesta (id ascendente); `p` es la lateral. */
const CFDIS_DE_LA_PROPUESTA = `
  SELECT jsonb_agg(jsonb_build_object(
           'id', g.id, 'uuidFiscal', g.uuid_fiscal, 'serie', g.serie,
           'folio', g.folio, 'nombreEmisor', g.nombre_emisor,
           'rfcReceptor', g.rfc_receptor, 'nombreReceptor', g.nombre_receptor,
           'fechaEmision', to_char(g.fecha_emision, 'YYYY-MM-DD'),
           'total', g.total::text, 'moneda', g.moneda,
           'metodoPago', g.metodo_pago, 'estado', g.estado) ORDER BY g.id) AS cfdis
    FROM decision_lineas gl
    JOIN cfdi g ON g.company_id = $1 AND g.id = gl.cfdi_id
   WHERE gl.company_id = $1 AND gl.decision_id = p.id`;

/** Estado derivado de una fila de DESDE_FILTRO; espeja `aFila`. */
const ESTADO_DERIVADO = `
  CASE WHEN m.estado = 'conciliado' THEN 'conciliado'
       WHEN p.id IS NOT NULL THEN 'sugerencia'
       ELSE 'sin_match' END`;

interface FilaSql {
  movimiento_id: string;
  fecha: string;
  monto: string;
  moneda: string;
  descripcion: string;
  referencia: string | null;
  estado_movimiento: string;
  motivo_sin_match: string | null;
  regla_sin_match: string | null;
  conciliacion_id: string | null;
  score: string | null;
  diferencia_monto: string | null;
  regla: string | null;
  motivo: string | null;
  n: string | null;
  requiere_revision: boolean | null;
  cfdi_id: string | null;
  uuid_fiscal: string | null;
  serie: string | null;
  folio: string | null;
  nombre_emisor: string | null;
  rfc_receptor: string | null;
  nombre_receptor: string | null;
  fecha_emision: string | null;
  total: string | null;
  cfdi_moneda: string | null;
  metodo_pago: string | null;
  cfdi_estado: EstadoCfdi | null;
  cfdis: CfdiResumenDto[] | null;
}

/**
 * CU-14. Bandeja de revisión: solo lectura, una fila por movimiento. Lee con
 * el manager de la transacción de la petición (RLS como cuadra_app) y además
 * filtra por empresa en cada consulta y join. Nunca escribe, nunca vuelve a
 * evaluar y nunca toca `xml_raw`.
 */
@Injectable()
export class BandejaService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async listar(
    companyId: string,
    consulta: ConsultaBandejaDto,
  ): Promise<RespuestaBandejaDto> {
    const estados = consulta.estado ?? ESTADOS_POR_DEFECTO;
    const pagina = consulta.pagina ?? 1;
    const limite = consulta.limite ?? LIMITE_POR_DEFECTO;
    const manager = this.contexto.manager();

    const [{ total }] = await manager.query<{ total: number }[]>(
      `SELECT count(*)::int AS total ${DESDE_FILTRO}`,
      [companyId, estados],
    );
    const filas = await manager.query<FilaSql[]>(
      `SELECT m.id AS movimiento_id,
              to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
              m.monto::text AS monto, m.moneda, m.descripcion, m.referencia,
              m.estado AS estado_movimiento,
              m.motivo_sin_match, m.regla_sin_match,
              p.id AS conciliacion_id, p.score::text AS score,
              p.diferencia_monto::text AS diferencia_monto,
              p.regla, p.motivo, p.n, p.requiere_revision,
              f.id AS cfdi_id, f.uuid_fiscal, f.serie, f.folio,
              f.nombre_emisor, f.rfc_receptor, f.nombre_receptor,
              to_char(f.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
              f.total::text AS total, f.moneda AS cfdi_moneda, f.metodo_pago,
              f.estado AS cfdi_estado,
              lc.cfdis
       ${DESDE_FILTRO.replace('WHERE m.company_id', `LEFT JOIN cfdi f ON f.company_id = $1 AND f.id = p.cfdi_id\n  LEFT JOIN LATERAL (${CFDIS_DE_LA_PROPUESTA}) lc ON true\n  WHERE m.company_id`)}
       ORDER BY m.monto DESC, m.id
       LIMIT $3 OFFSET $4`,
      [companyId, estados, limite, (pagina - 1) * limite],
    );

    return { datos: filas.map(aFila), pagina, limite, total };
  }

  /**
   * Conteos por estado y monto por revisar por moneda, con el mismo
   * predicado que `listar` para que cuadren con `total`. Los montos se suman
   * en SQL (NUMERIC) y viajan como texto; en TypeScript solo se suman
   * conteos enteros.
   */
  async resumen(companyId: string): Promise<ResumenBandejaDto> {
    const filas = await this.contexto.manager().query<
      {
        moneda: string;
        conciliado: number;
        sugerencia: number;
        sin_match: number;
        por_revisar: string;
      }[]
    >(
      `WITH f AS (
         SELECT m.moneda, m.monto, ${ESTADO_DERIVADO} AS estado
         ${DESDE_FILTRO}
       )
       SELECT moneda,
              (count(*) FILTER (WHERE estado = 'conciliado'))::int AS conciliado,
              (count(*) FILTER (WHERE estado = 'sugerencia'))::int AS sugerencia,
              (count(*) FILTER (WHERE estado = 'sin_match'))::int AS sin_match,
              COALESCE(sum(monto) FILTER (WHERE estado <> 'conciliado'), 0)::text
                AS por_revisar
         FROM f
        GROUP BY moneda
        ORDER BY moneda`,
      [companyId, [...ESTADOS_BANDEJA]],
    );

    const conteos = { conciliado: 0, sugerencia: 0, sin_match: 0 };
    const montoPorRevisar: { moneda: string; monto: string }[] = [];
    for (const f of filas) {
      conteos.conciliado += f.conciliado;
      conteos.sugerencia += f.sugerencia;
      conteos.sin_match += f.sin_match;
      if (f.sugerencia + f.sin_match > 0) {
        montoPorRevisar.push({ moneda: f.moneda, monto: f.por_revisar });
      }
    }
    return { conteos, montoPorRevisar };
  }
}

function aFila(f: FilaSql): FilaBandejaDto {
  const conciliado = f.estado_movimiento === 'conciliado';
  const estado: EstadoBandeja = conciliado
    ? 'conciliado'
    : f.conciliacion_id !== null
      ? 'sugerencia'
      : 'sin_match';
  const sinMatch = estado === 'sin_match';
  return {
    movimientoId: f.movimiento_id,
    fecha: f.fecha,
    monto: f.monto,
    descripcion: f.descripcion,
    referencia: f.referencia,
    moneda: f.moneda,
    estado,
    propuestasCount: estado === 'sugerencia' ? Number(f.n) : 0,
    motivo: sinMatch ? f.motivo_sin_match : f.motivo,
    regla: sinMatch ? f.regla_sin_match : f.regla,
    requiereRevision: f.requiere_revision === true,
    mejorPropuesta:
      f.conciliacion_id === null || f.cfdi_id === null
        ? null
        : {
            conciliacionId: f.conciliacion_id,
            score: f.score,
            regla: f.regla,
            motivo: f.motivo,
            diferenciaMonto: f.diferencia_monto,
            cfdis: f.cfdis ?? [],
            cfdi: {
              id: f.cfdi_id,
              uuidFiscal: f.uuid_fiscal as string,
              serie: f.serie,
              folio: f.folio,
              nombreEmisor: f.nombre_emisor,
              rfcReceptor: f.rfc_receptor as string,
              nombreReceptor: f.nombre_receptor,
              fechaEmision: f.fecha_emision as string,
              total: f.total as string,
              moneda: f.cfdi_moneda as string,
              metodoPago: f.metodo_pago,
              estado: f.cfdi_estado as EstadoCfdi,
            },
          },
  };
}
