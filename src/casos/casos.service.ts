import { Injectable, NotFoundException } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { EstadoMovimiento } from '../common/entities/tipos';
import type { EstadoBandeja } from '../bandeja/dto/bandeja.dto';
import type { PropuestaCasoDto, RespuestaCasoDto } from './dto/caso.dto';

/**
 * Una sola sentencia: movimiento, tolerancia de la empresa, propuestas
 * vigentes (o la confirmada), CFDI y quien confirmó salen de la misma
 * instantánea. Con dos sentencias, una confirmación concurrente podría dar
 * un movimiento abierto con una confirmada, o abierto sin propuestas.
 *
 * El CASE no tiene ELSE: un descartado no casa con ningún estado y no se
 * inventa propuesta. Las rechazadas tampoco casan nunca. `users` no tiene
 * company_id: el nombre se alcanza solo desde una conciliación filtrada por
 * empresa (mismo patrón que BitacoraService.historial).
 * Orden de propuestas: el mismo de la bandeja para su mejor propuesta.
 */
const CONSULTA = `
  SELECT m.id AS movimiento_id, to_char(m.fecha,'YYYY-MM-DD') AS fecha,
         m.monto::text AS monto, m.moneda, m.descripcion, m.referencia,
         m.estado AS estado_movimiento, m.regla_sin_match, m.motivo_sin_match,
         co.tolerancia_monto::text AS tolerancia_monto,
         c.id AS conciliacion_id, c.estado AS estado_conciliacion, c.origen,
         c.score::text AS score, c.regla, c.motivo,
         c.diferencia_monto::text AS diferencia_monto,
         c.confirmada_at, u.nombre AS confirmada_por,
         f.id AS cfdi_id, f.uuid_fiscal, f.serie, f.folio, f.nombre_emisor,
         f.rfc_receptor, f.nombre_receptor,
         to_char(f.fecha_emision,'YYYY-MM-DD') AS fecha_emision,
         f.total::text AS total, f.moneda AS cfdi_moneda, f.metodo_pago
    FROM movimientos m
    JOIN companies co ON co.id = m.company_id AND co.id = $2
    LEFT JOIN conciliaciones c
           ON c.company_id = $2 AND c.movimiento_id = m.id
          AND c.estado = CASE m.estado WHEN 'conciliado' THEN 'confirmada'
                                       WHEN 'abierto'    THEN 'propuesta' END
    LEFT JOIN cfdi f ON f.company_id = $2 AND f.id = c.cfdi_id
    LEFT JOIN users u ON u.id = c.confirmada_por_id
   WHERE m.id = $1 AND m.company_id = $2
     AND m.estado <> 'pendiente_revision' -- estacionado (3.5): no es un caso
   ORDER BY c.score DESC NULLS LAST, c.id`;

interface FilaSql {
  movimiento_id: string;
  fecha: string;
  monto: string;
  moneda: string;
  descripcion: string;
  referencia: string | null;
  estado_movimiento: EstadoMovimiento;
  regla_sin_match: string | null;
  motivo_sin_match: string | null;
  tolerancia_monto: string;
  conciliacion_id: string | null;
  estado_conciliacion: 'propuesta' | 'confirmada' | null;
  origen: PropuestaCasoDto['origen'] | null;
  score: string | null;
  regla: string | null;
  motivo: string | null;
  diferencia_monto: string | null;
  confirmada_at: Date | null;
  confirmada_por: string | null;
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
}

/**
 * CU-23. Detalle de un caso: solo lectura. Lee con el manager de la
 * transacción de la petición (RLS como cuadra_app) y además filtra por
 * empresa en cada tabla. Nunca escribe ni vuelve a correr el motor. Los
 * montos viajan como texto desde SQL: sin Number ni Decimal.
 */
@Injectable()
export class CasosService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async obtener(
    companyId: string,
    movimientoId: string,
  ): Promise<RespuestaCasoDto> {
    const filas = await this.contexto
      .manager()
      .query<FilaSql[]>(CONSULTA, [movimientoId, companyId]);
    if (filas.length === 0) {
      // Inexistente y ajeno son indistinguibles: RLS y el filtro lo ocultan.
      throw new NotFoundException('Movimiento no encontrado');
    }
    const m = filas[0];
    const propuestas = filas
      .filter((f) => f.conciliacion_id !== null)
      .map(aPropuesta);
    const estado: EstadoBandeja =
      m.estado_movimiento === 'conciliado'
        ? 'conciliado'
        : propuestas.length > 0
          ? 'sugerencia'
          : 'sin_match';
    const esSinMatch = estado === 'sin_match';
    // Un descartado guarda su regla, pero no es un "sin match" del motor.
    const conRegistro = esSinMatch && m.estado_movimiento !== 'descartado';
    return {
      movimiento: {
        id: m.movimiento_id,
        fecha: m.fecha,
        monto: m.monto,
        moneda: m.moneda,
        descripcion: m.descripcion,
        referencia: m.referencia,
        estado: m.estado_movimiento,
      },
      estado,
      sinMatch: esSinMatch
        ? {
            regla: conRegistro ? m.regla_sin_match : null,
            motivo: conRegistro ? m.motivo_sin_match : null,
          }
        : null,
      toleranciaMonto: m.tolerancia_monto,
      propuestas,
    };
  }
}

function aPropuesta(f: FilaSql): PropuestaCasoDto {
  return {
    conciliacionId: f.conciliacion_id as string,
    estado: f.estado_conciliacion as 'propuesta' | 'confirmada',
    origen: f.origen as PropuestaCasoDto['origen'],
    score: f.score,
    regla: f.regla,
    motivo: f.motivo,
    diferenciaMonto: f.diferencia_monto,
    confirmadaAt: f.confirmada_at ? f.confirmada_at.toISOString() : null,
    confirmadaPor: f.confirmada_por ? { nombre: f.confirmada_por } : null,
    cfdi: {
      id: f.cfdi_id as string,
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
    },
  };
}
