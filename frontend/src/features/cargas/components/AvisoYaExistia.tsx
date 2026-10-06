import estilos from './AvisoYaExistia.module.css';

export interface AvisoYaExistiaProps {
  /** Una o dos frases (K7); cada una va en su elemento, en un mismo renglón. */
  frases: readonly string[];
}

/**
 * Aviso de que el archivo ya se había cargado (K7). No abre región propia:
 * vive dentro de la región de estado de la tarjeta, que lo anuncia.
 */
export function AvisoYaExistia({ frases }: AvisoYaExistiaProps) {
  return (
    <div className={estilos.aviso}>
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
      <span className={estilos.texto}>
        {frases.map((frase) => (
          <span key={frase}>{frase}</span>
        ))}
      </span>
    </div>
  );
}
