import type { ReactNode } from 'react';
import { Monto } from '@/shared/ui/Monto';
import estilos from './DetalleCaso.module.css';

export interface DatoMontoProps {
  rotulo: string;
  titulo: string | null;
  monto: string;
  moneda: string;
  /** Líneas de apoyo bajo el monto. */
  apoyo: readonly ReactNode[];
}

/** Tarjeta «Movimiento bancario» o «CFDI candidato»: nombre, monto y apoyo. */
export function DatoMonto({
  rotulo,
  titulo,
  monto,
  moneda,
  apoyo,
}: DatoMontoProps) {
  return (
    <div className={estilos.dato}>
      <span className={estilos.rotulo}>{rotulo}</span>
      {titulo !== null ? (
        <span className={estilos.nombre}>{titulo}</span>
      ) : null}
      <span className={estilos.montoGrande}>
        <Monto
          valor={monto}
          codigoMoneda={moneda === 'MXN' ? undefined : moneda}
        />
      </span>
      {apoyo.map((linea, i) => (
        <span key={i} className={estilos.apoyo}>
          {linea}
        </span>
      ))}
    </div>
  );
}
