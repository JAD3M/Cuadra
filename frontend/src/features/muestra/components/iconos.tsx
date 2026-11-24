// Iconos decorativos de la muestra (trazos de los mockups, viewBox 24).

import type { ReactNode } from 'react';

interface PropsIcono {
  className?: string;
  tam?: number;
}

function Base({
  className,
  tam = 20,
  grosor = 2,
  children,
}: PropsIcono & { grosor?: number; children: ReactNode }) {
  return (
    <svg
      className={className}
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Círculo con palomita: aviso correcto. */
export function IconoCheck(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </Base>
  );
}

/** Círculo con «i»: aviso informativo. */
export function IconoInfo(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </Base>
  );
}

/** Círculo con cruz: aviso de desacuerdo. */
export function IconoDesacuerdo(props: PropsIcono) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Base>
  );
}

/** Palomita gruesa de los botones y chips. */
export function IconoPalomita(props: PropsIcono) {
  return (
    <Base {...props} grosor={3}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Base>
  );
}

/** Cruz gruesa de los botones y chips. */
export function IconoCruz(props: PropsIcono) {
  return (
    <Base {...props} grosor={3}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}
