import estilos from './AvisoSinSeparacion.module.css';

const TITULO = 'Esta empresa opera sin separación de funciones.';
const DETALLE =
  'Quien sube una carga también puede confirmar sus conciliaciones. Lo desactivó el dueño de la plataforma.';

/**
 * Aviso de que la empresa opera sin separación de funciones (UX-DR9; mockups
 * 2, 7 y 6). Solo presenta: quien lo monta decide cuándo mostrarlo.
 */
export function AvisoSinSeparacion() {
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
        <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z" />
        <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
      </svg>
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>{TITULO}</strong>
        <span className={estilos.detalle}>{DETALLE}</span>
      </div>
    </div>
  );
}
