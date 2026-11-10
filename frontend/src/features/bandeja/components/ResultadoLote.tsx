import type { ReactNode } from 'react';
import { ETIQUETAS_RAZON_OMISION_LOTE } from '@/shared/dominio/etiquetas';
import type { RazonOmisionLote } from '@/shared/dominio/tipos';
import { LOTE } from '@/features/bandeja/textos';
import estilos from './ResultadoLote.module.css';

export interface OmisionVisible {
  id: string;
  /** Descripción del movimiento, tal como estaba en la lista al confirmar. */
  descripcion: string;
  /** Etiqueta de la factura de la propuesta. */
  referencia: string;
  razon: RazonOmisionLote;
}

export interface ResultadoLoteProps {
  confirmadas: number;
  omitidas: readonly OmisionVisible[];
  /** Acción bajo el resultado (reabrir el lote, 5.8); ausente = ninguna. */
  accion?: ReactNode;
}

/**
 * Resultado de un lote (mockups 2 y 7): cuántas se confirmaron y, de las que
 * quedaron fuera, cuál y por qué, en palabras. Si no se confirmó ninguna, el
 * recuadro es ámbar y no dice «Lote confirmado». Presentacional.
 */
export function ResultadoLote({
  confirmadas,
  omitidas,
  accion,
}: ResultadoLoteProps) {
  const ninguna = confirmadas === 0;
  const hayOmitidas = omitidas.length > 0;
  return (
    <div
      role="status"
      className={
        ninguna ? `${estilos.recuadro} ${estilos.ninguna}` : estilos.recuadro
      }
    >
      <strong className={estilos.titulo}>
        {ninguna ? LOTE.ningunaTitulo : LOTE.resultadoTitulo(confirmadas)}
      </strong>
      {hayOmitidas ? (
        <span className={estilos.resumen}>
          {ninguna
            ? LOTE.ningunaOmitidas(omitidas.length)
            : LOTE.resultadoOmitidas(omitidas.length)}
        </span>
      ) : null}
      {hayOmitidas ? (
        <ul className={estilos.lista}>
          {omitidas.map((o) => (
            <li key={o.id} className={estilos.item}>
              <span className={estilos.descripcion}>
                {o.descripcion}{' '}
                <span className={estilos.referencia}>{o.referencia}</span>
              </span>
              <span className={estilos.razon}>
                {ETIQUETAS_RAZON_OMISION_LOTE[o.razon]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {accion}
    </div>
  );
}
