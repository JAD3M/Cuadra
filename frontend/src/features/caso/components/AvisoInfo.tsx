import estilos from './AvisoVarias.module.css';

/**
 * Caja informativa de una línea (icono ⓘ y texto) con el estilo del aviso de
 * varias propuestas. Región de estado: se anuncia sin interrumpir.
 */
export function AvisoInfo({ texto }: { texto: string }) {
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
      <span>{texto}</span>
    </div>
  );
}
