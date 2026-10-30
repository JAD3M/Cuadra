import type { EstadoCarga } from '../common/entities/tipos';
import type { ResultadoDeCarga } from './carga.entity';

/** Lo que ven el POST y el GET de una carga. */
export interface EstadoDeCarga {
  id: string;
  estado: EstadoCarga;
  totalRegistros: number;
  registrosOk: number;
  registrosExistentes: number;
  registrosError: number;
  /**
   * Historia 3.5: movimientos de esta carga en `pendiente_revision` (misma
   * huella que uno ya cargado, otra referencia). Se calcula al consultar; ya
   * están dentro de `registrosOk`. Solo cuenta en estados de cuenta ya
   * terminados; en lo demás es 0.
   */
  dudosos: number;
  resultados: ResultadoDeCarga[];
  /** Solo en 'fallida': mensaje genérico; el detalle va al log. */
  errorMensaje: string | null;
}

export interface FilaCarga {
  id: string;
  estado: EstadoCarga;
  total_registros: number;
  registros_ok: number;
  registros_existentes: number;
  registros_error: number;
  dudosos: number;
  resultados: ResultadoDeCarga[];
  error_mensaje: string | null;
}

/**
 * Las columnas que ven el POST y el GET. `dudosos` es calculado: un conteo de
 * `movimientos` de esta carga, siempre con `company_id`, solo para estados de
 * cuenta terminados (el sondeo de una carga en curso no paga la consulta).
 * Va calificado con `cargas.` porque `movimientos` también tiene `id`.
 */
export const SQL_ESTADO = `cargas.id, cargas.estado, cargas.total_registros,
  cargas.registros_ok, cargas.registros_existentes, cargas.registros_error,
  CASE WHEN cargas.tipo = 'estado_cuenta'
        AND cargas.estado IN ('procesada', 'con_errores')
       THEN (SELECT count(*)::int FROM movimientos m
              WHERE m.company_id = cargas.company_id
                AND m.carga_id = cargas.id
                AND m.estado = 'pendiente_revision')
       ELSE 0 END AS dudosos,
  cargas.resultados, cargas.error_mensaje`;

export function aEstado(fila: FilaCarga): EstadoDeCarga {
  return {
    id: fila.id,
    estado: fila.estado,
    totalRegistros: fila.total_registros,
    registrosOk: fila.registros_ok,
    registrosExistentes: fila.registros_existentes,
    registrosError: fila.registros_error,
    dudosos: fila.dudosos,
    resultados: fila.resultados,
    errorMensaje: fila.error_mensaje,
  };
}
