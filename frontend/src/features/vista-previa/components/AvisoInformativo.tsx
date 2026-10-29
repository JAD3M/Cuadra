import type { ReactNode } from 'react';
import estilos from './AvisoInformativo.module.css';

export interface AvisoInformativoProps {
  children: ReactNode;
}

/** Caja informativa azul del mockup (`.info`): una región de estado, sin acciones. */
export function AvisoInformativo({ children }: AvisoInformativoProps) {
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
      <div className={estilos.texto}>{children}</div>
    </div>
  );
}
