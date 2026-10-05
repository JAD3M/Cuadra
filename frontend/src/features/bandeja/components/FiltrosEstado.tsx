import { useId } from 'react';
import { ESTADOS_BANDEJA, type EstadoBandeja } from '@/shared/dominio/bandeja';
import { ETIQUETAS_ESTADO_BANDEJA } from '@/shared/dominio/etiquetas';
import {
  AVISO_ULTIMO_FILTRO,
  GRUPO_FILTROS,
  ORDEN,
} from '@/features/bandeja/textos';
import estilos from './FiltrosEstado.module.css';

export interface FiltrosEstadoProps {
  /** Estados activos. El contenedor garantiza que siempre hay al menos uno. */
  estados: readonly EstadoBandeja[];
  /** Pide alternar un estado; nunca se llama para el último chip activo. */
  onAlternar: (estado: EstadoBandeja) => void;
}

/**
 * Barra de filtros de la bandeja: chips combinables por estado y, a la
 * derecha, el aviso del último filtro y el orden fijo (monto ↓). Presentacional:
 * no conoce la URL ni la API. El último chip activo no se puede apagar; sigue
 * enfocable (`aria-disabled`) y su aviso visible lo describe.
 */
export function FiltrosEstado({ estados, onAlternar }: FiltrosEstadoProps) {
  const idAviso = useId();
  const unSoloActivo = estados.length === 1;

  return (
    <div className={estilos.barra}>
      <div className={estilos.grupo} role="group" aria-label={GRUPO_FILTROS}>
        {ESTADOS_BANDEJA.map((estado) => {
          const activo = estados.includes(estado);
          const esUltimo = unSoloActivo && activo;
          return (
            <button
              key={estado}
              type="button"
              className={
                activo ? `${estilos.chip} ${estilos.activo}` : estilos.chip
              }
              aria-pressed={activo}
              aria-disabled={esUltimo ? 'true' : undefined}
              aria-describedby={esUltimo ? idAviso : undefined}
              onClick={() => {
                if (!esUltimo) onAlternar(estado);
              }}
            >
              {ETIQUETAS_ESTADO_BANDEJA[estado]}
            </button>
          );
        })}
      </div>
      <span className={estilos.apoyo}>
        {unSoloActivo ? (
          <span role="status" id={idAviso}>
            {AVISO_ULTIMO_FILTRO}
          </span>
        ) : null}
        <span>{ORDEN}</span>
      </span>
    </div>
  );
}
