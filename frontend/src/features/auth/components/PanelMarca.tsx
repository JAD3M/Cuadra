import estilos from './PanelMarca.module.css';

/**
 * Panel de marca de la pantalla de acceso: marca, titular y línea de apoyo.
 * Es decorativo respecto del formulario: el titular es un párrafo (no un
 * encabezado) porque el panel se oculta en pantallas angostas y el único
 * `h1` de la página es el del formulario. No lleva contadores ni cifras.
 */
export function PanelMarca() {
  return (
    <div className={estilos.panel}>
      <div className={estilos.marca}>
        <svg
          className={estilos.logo}
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="3" y="3" width="30" height="30" rx="8" />
          <path d="M11 18l5 5 9-11" />
        </svg>
        <span className={estilos.nombre}>Cuadra</span>
      </div>
      <div className={estilos.mensaje}>
        <p className={estilos.titular}>Cada peso del banco, con su CFDI.</p>
        <p className={estilos.apoyo}>
          El motor de reglas propone. Tú confirmas. Nada se cierra solo.
        </p>
      </div>
    </div>
  );
}
