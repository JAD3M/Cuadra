import { DECISION } from '@/features/caso/textos';
import estilos from './AvisoVarias.module.css';

/**
 * Nota del detalle para quien no puede confirmar ni rechazar (por ejemplo,
 * el auditor): ve el caso completo, sin controles de decisión. Reutiliza el
 * estilo informativo del aviso de varias propuestas.
 */
export function AvisoSoloLectura() {
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
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
      <span>{DECISION.soloLectura}</span>
    </div>
  );
}
