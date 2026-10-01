import type { ButtonHTMLAttributes } from 'react';
import estilos from './Button.module.css';

export type VarianteButton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primario`: acción principal (confirmar). `secundario`: acción neutra
   * con borde (paginación). `peligro`: acción destructiva con contorno.
   * `fantasma`: acción en línea con aspecto de enlace.
   */
  variante?: VarianteButton;
}

/**
 * Botón real. El tipo por omisión es `button` para que nunca envíe un
 * formulario por accidente. Deshabilitado deja de responder al clic y cambia
 * el borde a discontinuo, de modo que el estado no depende solo del color.
 */
export function Button({
  variante = 'primario',
  type = 'button',
  className,
  ...resto
}: ButtonProps) {
  const clases = [estilos.boton, estilos[variante], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...resto}
      type={type}
      className={clases}
      data-variante={variante}
    />
  );
}
