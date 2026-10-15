import type { ComponentProps } from 'react';
import estilos from './Button.module.css';

export type VarianteButton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export type TonoButton = 'acento' | 'conciliado' | 'sin_match';

export interface ButtonProps extends ComponentProps<'button'> {
  /**
   * `primario`: acción principal (confirmar). `secundario`: acción neutra
   * con borde (paginación). `peligro`: acción destructiva con contorno.
   * `fantasma`: acción en línea con aspecto de enlace.
   */
  variante?: VarianteButton;
  /**
   * Color del relleno de la variante `primario`; las demás lo ignoran.
   * `acento` (azul): acción general. `conciliado` (verde): confirmar.
   * `sin_match` (naranja): acciones de estado de cuenta y tolerancia.
   */
  tono?: TonoButton;
}

/**
 * Botón real. El tipo por omisión es `button` para que nunca envíe un
 * formulario por accidente. Deshabilitado deja de responder al clic y cambia
 * el borde a discontinuo, de modo que el estado no depende solo del color.
 */
export function Button({
  variante = 'primario',
  tono = 'acento',
  type = 'button',
  className,
  ...resto
}: ButtonProps) {
  const esPrimario = variante === 'primario';
  const clases = [
    estilos.boton,
    estilos[variante],
    esPrimario && estilos[tono],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...resto}
      type={type}
      className={clases}
      data-variante={variante}
      data-tono={esPrimario ? tono : undefined}
    />
  );
}
