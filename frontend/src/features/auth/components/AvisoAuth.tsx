import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import estilos from './AvisoAuth.module.css';

export interface AvisoAuthProps {
  children: ReactNode;
  /** Mueve el foco al aviso al montarse (llegada a la pantalla). */
  enfocar?: boolean;
}

/**
 * Aviso informativo de las pantallas de acceso. `role="status"` lo anuncia
 * sin interrumpir; `tabIndex={-1}` permite enfocarlo desde código sin
 * agregarlo al orden de tabulación.
 */
export function AvisoAuth({ children, enfocar = false }: AvisoAuthProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enfocar) ref.current?.focus();
  }, [enfocar]);
  return (
    <div ref={ref} role="status" tabIndex={-1} className={estilos.aviso}>
      {children}
    </div>
  );
}
