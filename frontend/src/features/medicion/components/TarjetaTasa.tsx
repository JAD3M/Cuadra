import { useId } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  ERROR_CONEXION,
  REINTENTAR,
  SIN_DATOS,
  SIN_TRATADAS,
  TARJETA_TASA,
} from '@/features/medicion/textos';
import type { VistaMedicion } from '@/features/medicion/vista';
import estilos from './TarjetaTasa.module.css';

export interface TarjetaTasaProps {
  vista: VistaMedicion;
  /** Ausente = sin reintento. */
  onReintentar?: () => void;
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className={estilos.aviso} role="status">
      <svg
        className={estilos.avisoIcono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
      <div className={estilos.avisoTexto}>
        <strong className={estilos.avisoTitulo}>{titulo}</strong>
        <span className={estilos.avisoDetalle}>{detalle}</span>
      </div>
    </div>
  );
}

/**
 * Tarjeta «Tasa de desacuerdo» (Medicion.dc.html). La tasa llega ya formateada
 * como texto y las cifras son enteros: nada pasa por flotante. Sin propuestas,
 * o con propuestas todavía sin tratar, no hay tasa: se muestra un aviso y
 * nunca un cero que afirmaría un acuerdo que no se midió.
 */
export function TarjetaTasa({ vista, onReintentar }: TarjetaTasaProps) {
  const idTitulo = useId();
  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.titulo}>
        {TARJETA_TASA.titulo}
      </h2>
      {vista.tipo === 'cargando' ? (
        <div role="status" aria-busy="true" className={estilos.esqueleto}>
          <span className="solo-lectores">{TARJETA_TASA.cargando}</span>
          <div className={estilos.barraTasa} aria-hidden="true" />
          <div className={estilos.barraLarga} aria-hidden="true" />
          <div className={estilos.barraCorta} aria-hidden="true" />
        </div>
      ) : null}
      {vista.tipo === 'error' ? (
        <AlertaError
          {...ERROR_CONEXION}
          accion={
            onReintentar === undefined ? undefined : (
              <Button variante="secundario" onClick={onReintentar}>
                {REINTENTAR}
              </Button>
            )
          }
        />
      ) : null}
      {vista.tipo === 'sin_datos' ? <Aviso {...SIN_DATOS} /> : null}
      {vista.tipo === 'sin_tratadas' ? (
        <Aviso
          titulo={SIN_TRATADAS.titulo}
          detalle={SIN_TRATADAS.detalle(vista.propuestas)}
        />
      ) : null}
      {vista.tipo === 'listo' ? (
        <>
          <div className={estilos.tasa}>
            <span className={estilos.cifra}>{vista.tasa}</span>
            <p className={estilos.explicacion}>{TARJETA_TASA.explicacion}</p>
          </div>
          <dl className={estilos.datos}>
            <div className={estilos.dato}>
              <dt className={estilos.rotulo}>{TARJETA_TASA.propuestas}</dt>
              <dd className={estilos.valor}>{vista.propuestas}</dd>
            </div>
            <div className={estilos.dato}>
              <dt className={estilos.rotulo}>{TARJETA_TASA.tratadas}</dt>
              <dd className={estilos.valor}>{vista.tratadas}</dd>
            </div>
            <div className={estilos.dato}>
              <dt className={estilos.rotulo}>{TARJETA_TASA.desacuerdos}</dt>
              <dd className={`${estilos.valor} ${estilos.valorDesacuerdo}`}>
                {vista.desacuerdos}
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}
