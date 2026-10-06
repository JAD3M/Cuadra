import { CARGA_FALLIDA } from '@/features/cargas/textos';
import estilos from './ResultadoFallido.module.css';

/**
 * La carga falló: solo el aviso fijo del mockup v23 con su icono. Sin etiqueta,
 * sin mensaje del servidor y sin lista de archivos. No abre un `role="alert"`
 * propio: anidaría una región viva dentro de la región de estado de la tarjeta,
 * que ya lo anuncia.
 */
export function ResultadoFallido() {
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
      <span className={estilos.aviso}>{CARGA_FALLIDA}</span>
    </div>
  );
}
