import type { VistaPanel } from '@/features/cargas/vista';
import { AvisoActualizacion } from './AvisoActualizacion';
import { AvisoYaExistia } from './AvisoYaExistia';
import { ResultadoCfdi, type ArchivoResultado } from './ResultadoCfdi';
import {
  ResultadoEstadoCuenta,
  type FilaConError,
} from './ResultadoEstadoCuenta';
import { ResultadoFallido } from './ResultadoFallido';
import { ResultadoProcesando } from './ResultadoProcesando';

/** Una fila del detalle de un estado de cuenta (siempre un error). */
type FilaResultado = FilaConError & {
  resultado: ArchivoResultado['resultado'];
};

/** Una entrada del detalle: por archivo (CFDI) o por fila (estado de cuenta). */
export type EntradaResultado = ArchivoResultado | FilaResultado;

export interface PanelCargaProps {
  vista: Exclude<VistaPanel, 'ninguno'>;
  /** Frases de K7 si la carga ya existía; `null` si es nueva. */
  frasesYaExistia: readonly string[] | null;
  conteo: { ok: number; existentes: number; error: number };
  resultados: readonly EntradaResultado[];
  /**
   * Presente solo cuando venció el tope del polling: una carga aún activa ya
   * no se actualiza sola, así que en lugar de la barra se ofrece «Actualizar».
   */
  alActualizar?: () => void;
}

/**
 * El panel de la carga recién subida: el aviso de K7 (si aplica) y el cuerpo
 * que toca según la vista (`solo_aviso` no tiene cuerpo). Solo presentación;
 * el contenedor decide la vista.
 */
export function PanelCarga({
  vista,
  frasesYaExistia,
  conteo,
  resultados,
  alActualizar,
}: PanelCargaProps) {
  return (
    <>
      {frasesYaExistia === null ? null : (
        <AvisoYaExistia frases={frasesYaExistia} />
      )}
      {vista === 'en_curso' && alActualizar === undefined ? (
        <ResultadoProcesando />
      ) : null}
      {vista === 'en_curso' && alActualizar !== undefined ? (
        <AvisoActualizacion
          estado="detenida"
          variante="tarjeta"
          onActualizar={alActualizar}
        />
      ) : null}
      {vista === 'sin_proceso' ? <ResultadoFallido /> : null}
      {vista === 'por_archivo' ? (
        <ResultadoCfdi
          nuevos={conteo.ok}
          existentes={conteo.existentes}
          conError={conteo.error}
          archivos={resultados.filter(
            (r): r is ArchivoResultado => 'archivo' in r,
          )}
        />
      ) : null}
      {vista === 'por_fila' ? (
        <ResultadoEstadoCuenta
          registros={conteo.ok}
          conError={conteo.error}
          filas={resultados.filter((r): r is FilaResultado => 'fila' in r)}
        />
      ) : null}
    </>
  );
}
