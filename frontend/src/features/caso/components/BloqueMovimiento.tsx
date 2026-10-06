import { useId } from 'react';
import { Monto } from '@/shared/ui/Monto';
import { MONEDA_BASE } from '@/features/bandeja/constantes';
import { formatearFecha } from '@/features/bandeja/fecha';
import { MOVIMIENTO } from '@/features/caso/textos';
import comunes from './bloques.module.css';

export interface BloqueMovimientoProps {
  /** `YYYY-MM-DD`: se separa por texto, nunca a través de `Date`. */
  fecha: string;
  descripcion: string;
  referencia: string | null;
  /** Decimal en cadena tal como lo envía la API. */
  monto: string;
  moneda: string;
  /**
   * El servidor dice que la regla de la propuesta es referencia y monto
   * exactos: la referencia lleva la ✓ y el color de acierto (B14).
   */
  referenciaCoincide?: boolean;
}

/**
 * «Movimiento bancario»: monto grande (sin partirse), fecha, referencia y
 * descripción. Una moneda distinta de MXN se escribe tras el monto, dentro del
 * mismo elemento; con MXN el código va debajo, como en la maqueta.
 */
export function BloqueMovimiento({
  fecha,
  descripcion,
  referencia,
  monto,
  moneda,
  referenciaCoincide = false,
}: BloqueMovimientoProps) {
  const titulo = useId();
  const esBase = moneda === MONEDA_BASE;
  return (
    <section className={comunes.tarjeta} aria-labelledby={titulo}>
      <h3 id={titulo} className={comunes.rotulo}>
        {MOVIMIENTO.titulo}
      </h3>
      <div className={comunes.cifra}>
        <span className={comunes.monto}>
          <Monto valor={monto} codigoMoneda={esBase ? undefined : moneda} />
        </span>
        {esBase ? <span className={comunes.subtexto}>{moneda}</span> : null}
      </div>
      <dl className={comunes.kv}>
        <div>
          <dt>{MOVIMIENTO.fecha}</dt>
          <dd className={comunes.mono}>{formatearFecha(fecha)}</dd>
        </div>
        <div>
          <dt>{MOVIMIENTO.referencia}</dt>
          {referencia === null ? (
            <dd className={comunes.atenuado}>{MOVIMIENTO.sinReferencia}</dd>
          ) : (
            <dd
              className={`${comunes.mono} ${comunes.texto} ${referenciaCoincide ? comunes.acierto : ''}`}
            >
              {referencia}
              {referenciaCoincide ? (
                <>
                  {' '}
                  <span aria-hidden="true">✓</span>
                  <span className="solo-lectores">
                    {MOVIMIENTO.coincideConCfdi}
                  </span>
                </>
              ) : null}
            </dd>
          )}
        </div>
        <div className={comunes.completa}>
          <dt>{MOVIMIENTO.descripcion}</dt>
          <dd className={comunes.texto}>{descripcion}</dd>
        </div>
      </dl>
    </section>
  );
}
