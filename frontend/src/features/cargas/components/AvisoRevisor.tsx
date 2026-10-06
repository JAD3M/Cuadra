import { AVISO_REVISOR } from '@/features/cargas/textos';
import estilos from './AvisoRevisor.module.css';

/**
 * Aviso de solo lectura para un rol que no sube cargas. Las tarjetas siguen a
 * la vista con sus controles deshabilitados; el aviso explica por qué.
 */
export function AvisoRevisor() {
  return (
    <div role="status" className={estilos.aviso}>
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
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>{AVISO_REVISOR.titulo}</strong>
        <span className={estilos.detalle}>{AVISO_REVISOR.detalle}</span>
      </div>
    </div>
  );
}
