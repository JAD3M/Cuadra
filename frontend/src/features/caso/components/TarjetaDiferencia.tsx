import { useId } from 'react';
import {
  clasificarDiferencia,
  dentroDeTolerancia,
  proporcionTolerancia,
} from '@/shared/dinero';
import { Monto } from '@/shared/ui/Monto';
import { DIFERENCIA } from '@/features/caso/textos';
import comunes from './bloques.module.css';
import estilos from './TarjetaDiferencia.module.css';

export interface TarjetaDiferenciaProps {
  /** Diferencia con signo como decimal en cadena; `null` si no hay dato. */
  diferenciaMonto: string | null;
  /** Tolerancia de la empresa como decimal en cadena. */
  toleranciaMonto: string;
}

/**
 * Diferencia entre el movimiento y el CFDI, con la nota y la barra de la
 * tolerancia. Todo sobre las cadenas originales con aritmética decimal: la
 * nota, el resalte y el ancho de la barra son ayudas de pantalla; el servidor
 * sigue siendo quien decide.
 */
export function TarjetaDiferencia({
  diferenciaMonto,
  toleranciaMonto,
}: TarjetaDiferenciaProps) {
  const titulo = useId();
  const clase = clasificarDiferencia(diferenciaMonto);
  const resaltada = clase === 'subcentavo' || clase === 'distinta';
  const dentro = dentroDeTolerancia(diferenciaMonto, toleranciaMonto);
  const ancho = proporcionTolerancia(diferenciaMonto, toleranciaMonto);
  return (
    <section className={comunes.tarjeta} aria-labelledby={titulo}>
      <div className={estilos.cabecera}>
        <div className={estilos.cifra}>
          <h3 id={titulo} className={comunes.rotulo}>
            {DIFERENCIA.titulo}
          </h3>
          <span
            className={`${comunes.monto} ${resaltada ? estilos.resaltada : estilos.atenuada}`}
            data-clase={clase}
          >
            <Monto valor={diferenciaMonto} />
            {clase === 'subcentavo' ? (
              <span className="solo-lectores">
                {' '}
                {DIFERENCIA.menorAUnCentavo}
              </span>
            ) : null}
          </span>
        </div>
        {dentro ? (
          <span className={estilos.nota}>{DIFERENCIA.dentroDeTolerancia}</span>
        ) : null}
      </div>
      <div className={estilos.escala}>
        <div className={estilos.pista} aria-hidden="true">
          <div
            className={estilos.relleno}
            data-testid="barra-tolerancia"
            style={{ width: `${ancho}%` }}
          />
        </div>
        <div className={estilos.extremos}>
          <span>
            <Monto valor="0" />
          </span>
          <span>
            {DIFERENCIA.tolerancia} <Monto valor={toleranciaMonto} />
          </span>
        </div>
      </div>
    </section>
  );
}
