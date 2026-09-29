import { Injectable } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import {
  type ConsultaBandejaDto,
  type EstadoBandeja,
  ESTADOS_POR_DEFECTO,
  type FilaBandejaDto,
  type RespuestaBandejaDto,
} from './dto/bandeja.dto';

/**
 * Movimiento con su propuesta vigente. Para un conciliado la lateral toma la
 * fila 'confirmada'; para uno abierto, una 'propuesta'. Se comparte con el
 * conteo para que `total` no dependa de la lista.
 */
const DESDE_FILTRO = `
  FROM movimientos m
  LEFT JOIN LATERAL (
    SELECT c.id
      FROM conciliaciones c
     WHERE c.company_id = $1
       AND c.movimiento_id = m.id
       AND c.estado = CASE WHEN m.estado = 'conciliado'
                           THEN 'confirmada' ELSE 'propuesta' END
     LIMIT 1
  ) p ON true
  WHERE m.company_id = $1
    AND m.monto > 0
    AND (
      (m.estado = 'conciliado' AND 'conciliado' = ANY($2))
      OR (m.estado = 'abierto' AND p.id IS NOT NULL AND 'sugerencia' = ANY($2))
      OR (m.estado = 'abierto' AND p.id IS NULL
          AND m.regla_sin_match IS NOT NULL AND 'sin_match' = ANY($2))
    )`;

interface FilaSql {
  movimiento_id: string;
  fecha: string;
  monto: string;
  moneda: string;
  descripcion: string;
  referencia: string | null;
  estado_movimiento: string;
  conciliacion_id: string | null;
}

/**
 * CU-14. Bandeja de revisión: solo lectura, una fila por movimiento. Lee con
 * el manager de la transacción de la petición (RLS como cuadra_app) y además
 * filtra por empresa en cada consulta y join. Nunca escribe ni vuelve a
 * evaluar.
 */
@Injectable()
export class BandejaService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async listar(
    companyId: string,
    consulta: ConsultaBandejaDto,
  ): Promise<RespuestaBandejaDto> {
    const estados = consulta.estado ?? ESTADOS_POR_DEFECTO;
    const manager = this.contexto.manager();

    const [{ total }] = await manager.query<{ total: number }[]>(
      `SELECT count(*)::int AS total ${DESDE_FILTRO}`,
      [companyId, estados],
    );
    const filas = await manager.query<FilaSql[]>(
      `SELECT m.id AS movimiento_id,
              to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
              m.monto::text AS monto, m.moneda, m.descripcion, m.referencia,
              m.estado AS estado_movimiento, p.id AS conciliacion_id
       ${DESDE_FILTRO}
       ORDER BY m.monto DESC, m.id`,
      [companyId, estados],
    );

    return { datos: filas.map(aFila), total };
  }
}

function aFila(f: FilaSql): FilaBandejaDto {
  const estado: EstadoBandeja =
    f.estado_movimiento === 'conciliado'
      ? 'conciliado'
      : f.conciliacion_id !== null
        ? 'sugerencia'
        : 'sin_match';
  return {
    movimientoId: f.movimiento_id,
    fecha: f.fecha,
    monto: f.monto,
    descripcion: f.descripcion,
    referencia: f.referencia,
    moneda: f.moneda,
    estado,
  };
}
