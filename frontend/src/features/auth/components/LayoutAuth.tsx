import type { ReactNode } from 'react';
import { PanelMarca } from './PanelMarca';
import estilos from './LayoutAuth.module.css';

export interface LayoutAuthProps {
  /** Control de tema: va arriba a la derecha del panel del formulario. */
  controlTema: ReactNode;
  children: ReactNode;
  /**
   * `main` por omisión: la pantalla de acceso no tiene shell, así que su
   * layout es el landmark principal. La galería usa `div` para no repetirlo.
   */
  como?: 'main' | 'div';
  /**
   * Panel de marca. Por omisión el de la empresa; el acceso de plataforma
   * pasa el suyo (misma disposición, otro titular).
   */
  panel?: ReactNode;
}

/**
 * Disposición dividida de login y elección de empresa. Solo presentación:
 * el control de tema y el contenido llegan por props. El control de tema es
 * lo primero del panel del formulario, antes de cualquier campo.
 */
export function LayoutAuth({
  controlTema,
  children,
  como: Elemento = 'main',
  panel = <PanelMarca />,
}: LayoutAuthProps) {
  return (
    <Elemento className={estilos.layout}>
      <div className={estilos.marca}>{panel}</div>
      <div className={estilos.formulario}>
        <div className={estilos.tema}>{controlTema}</div>
        <div className={estilos.contenido}>{children}</div>
      </div>
    </Elemento>
  );
}
