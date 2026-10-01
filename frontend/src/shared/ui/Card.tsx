import type { ReactNode } from 'react';
import estilos from './Card.module.css';

export interface CardProps {
  /** Elemento HTML de la superficie. Por omisión `div`. */
  as?: 'div' | 'section' | 'article';
  /** Superficie elevada (por ejemplo, el tile de monto de la bandeja). */
  elevada?: boolean;
  children: ReactNode;
}

/** Superficie con borde y radio de las maquetas. Solo presentación. */
export function Card({
  as: Elemento = 'div',
  elevada = false,
  children,
}: CardProps) {
  const clases = elevada ? `${estilos.card} ${estilos.elevada}` : estilos.card;
  return (
    <Elemento className={clases} data-elevada={elevada}>
      {children}
    </Elemento>
  );
}
