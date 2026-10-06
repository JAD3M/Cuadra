import { CARGA_FALLIDA } from '@/features/cargas/textos';
import { ETIQUETAS_ESTADO_CARGA } from '@/shared/dominio';
import estilos from './ResultadoFallido.module.css';

export interface ResultadoFallidoProps {
  /** Mensaje genérico del servidor; texto plano. `null` si no mandó ninguno. */
  errorMensaje: string | null;
}

/**
 * La carga falló: la etiqueta Fallida, el aviso fijo del mockup y, si el
 * servidor mandó uno, su mensaje. No hay lista de archivos. No abre un
 * `role="alert"` propio: la región de estado de la tarjeta ya lo anuncia.
 */
export function ResultadoFallido({ errorMensaje }: ResultadoFallidoProps) {
  return (
    <div className={estilos.fallido}>
      <svg
        className={estilos.icono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <div className={estilos.texto}>
        <strong className={estilos.etiqueta}>
          {ETIQUETAS_ESTADO_CARGA.fallida}
        </strong>
        <span className={estilos.aviso}>{CARGA_FALLIDA}</span>
        {errorMensaje ? (
          <span className={estilos.detalle} data-detalle>
            {errorMensaje}
          </span>
        ) : null}
      </div>
    </div>
  );
}
