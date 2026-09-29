import type { ResultadoDeCarga } from './carga.entity';

/** Lo que entrega el procesamiento de cada tipo de carga al worker. */
export interface ResultadoDeProceso {
  /** Lo que se guarda en `cargas.resultados`. */
  resultados: ResultadoDeCarga[];
  nuevos: number;
  existentes: number;
  errores: number;
}
