import { TarjetaCfdi, type CfdiTarjeta } from './TarjetaCfdi';
import { TarjetaDiferencia } from './TarjetaDiferencia';
import { TarjetaMotor } from './TarjetaMotor';
import estilos from './DetallePropuesta.module.css';

/** Lo que el detalle necesita de la propuesta expandida. */
export interface PropuestaDetalle {
  regla: string | null;
  motivo: string | null;
  diferenciaMonto: string | null;
  cfdi: CfdiTarjeta;
}

export interface DetallePropuestaProps {
  propuesta: PropuestaDetalle;
  toleranciaMonto: string;
}

/** La propuesta expandida: CFDI y diferencia en pareja, y el motivo del motor. */
export function DetallePropuesta({
  propuesta,
  toleranciaMonto,
}: DetallePropuestaProps) {
  return (
    <div className={estilos.detalle}>
      <div className={estilos.par}>
        <TarjetaCfdi cfdi={propuesta.cfdi} />
        <TarjetaDiferencia
          diferenciaMonto={propuesta.diferenciaMonto}
          toleranciaMonto={toleranciaMonto}
        />
      </div>
      <TarjetaMotor regla={propuesta.regla} motivo={propuesta.motivo} />
    </div>
  );
}
