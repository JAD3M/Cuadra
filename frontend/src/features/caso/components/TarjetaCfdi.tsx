import { useId } from 'react';
import { Monto } from '@/shared/ui/Monto';
import { MONEDA_BASE } from '@/features/bandeja/constantes';
import { formatearFecha } from '@/features/bandeja/fecha';
import { SIN_DATO } from '@/features/bandeja/textos';
import { CFDI } from '@/features/caso/textos';
import comunes from './bloques.module.css';
import estilos from './TarjetaCfdi.module.css';

/** Lo que la tarjeta necesita del CFDI; el del contrato la cumple. */
export interface CfdiTarjeta {
  uuidFiscal: string;
  serie: string | null;
  folio: string | null;
  fechaEmision: string;
  total: string;
  moneda: string;
  metodoPago: string | null;
}

export interface TarjetaCfdiProps {
  cfdi: CfdiTarjeta;
  /**
   * El servidor dice que la regla de la propuesta es referencia y monto
   * exactos: serie-folio lleva la ✓ y el color de acierto (B14).
   */
  serieFolioCoincide?: boolean;
}

function serieFolio(cfdi: CfdiTarjeta): string {
  const partes = [cfdi.serie, cfdi.folio].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  );
  return partes.length > 0 ? partes.join('-') : SIN_DATO;
}

/**
 * CFDI candidato de la propuesta expandida: total con su moneda, emisión,
 * serie-folio y UUID, como en la maqueta (sin emisor ni receptor, B13). Los
 * datos que el CFDI no trae se muestran como guion: nada se inventa.
 */
export function TarjetaCfdi({
  cfdi,
  serieFolioCoincide = false,
}: TarjetaCfdiProps) {
  const titulo = useId();
  const esBase = cfdi.moneda === MONEDA_BASE;
  const subtexto = [esBase ? cfdi.moneda : null, cfdi.metodoPago]
    .filter((p): p is string => p !== null)
    .join(' · ');
  return (
    <section
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={`${comunes.rotulo} ${estilos.rotulo}`}>
        {CFDI.titulo}
      </h3>
      <div className={comunes.cifra}>
        <span className={comunes.monto}>
          <Monto
            valor={cfdi.total}
            codigoMoneda={esBase ? undefined : cfdi.moneda}
          />
        </span>
        {subtexto === '' ? null : (
          <span className={comunes.subtexto}>{subtexto}</span>
        )}
      </div>
      <dl className={comunes.kv}>
        <div>
          <dt>{CFDI.emision}</dt>
          <dd className={comunes.mono}>{formatearFecha(cfdi.fechaEmision)}</dd>
        </div>
        <div>
          <dt>{CFDI.serieFolio}</dt>
          <dd
            className={`${comunes.mono} ${serieFolioCoincide ? comunes.acierto : ''}`}
          >
            {serieFolio(cfdi)}
            {serieFolioCoincide ? (
              <>
                {' '}
                <span aria-hidden="true">✓</span>
                <span className="solo-lectores">
                  {CFDI.coincideConMovimiento}
                </span>
              </>
            ) : null}
          </dd>
        </div>
        <div className={comunes.completa}>
          <dt>{CFDI.uuid}</dt>
          <dd className={`${comunes.mono} ${estilos.uuid}`}>
            {cfdi.uuidFiscal}
          </dd>
        </div>
      </dl>
    </section>
  );
}
