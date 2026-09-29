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
  resultados: ResultadoDeCarga[];
  error_mensaje: string | null;
}

export const SQL_ESTADO = `id, estado, total_registros, registros_ok,
  registros_existentes, registros_error, resultados, error_mensaje`;

export function aEstado(fila: FilaCarga): EstadoDeCarga {
  return {
    id: fila.id,
    estado: fila.estado,
    totalRegistros: fila.total_registros,
    registrosOk: fila.registros_ok,
    registrosExistentes: fila.registros_existentes,
    registrosError: fila.registros_error,
    resultados: fila.resultados,
    errorMensaje: fila.error_mensaje,
  };
}
