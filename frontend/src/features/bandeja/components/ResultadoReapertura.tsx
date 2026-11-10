import { ETIQUETAS_RAZON_OMISION_REAPERTURA } from '@/shared/dominio/etiquetas';
import type { RazonOmisionReapertura } from '@/shared/dominio/tipos';
import { REABRIR_LOTE } from '@/features/bandeja/textos';
import estilos from './ResultadoLote.module.css';

export interface OmisionReaperturaVisible {
  id: string;
  /** Descripción del movimiento, tal como estaba en la lista al confirmar. */
  descripcion: string;
  /** Etiqueta de la factura de la propuesta. */
  referencia: string;
  razon: RazonOmisionReapertura;
}

export interface ResultadoReaperturaProps {
  reabiertas: number;
  omitidas: readonly OmisionReaperturaVisible[];
}

/**
 * Resultado de reabrir un lote (mockups 2 y 7): cuántos casos volvieron a
 * pendiente y, de los que quedaron fuera, cuál y por qué. Si no se reabrió
 * ninguno, el recuadro es ámbar y no dice «Lote reabierto». Presentacional.
 */
export function ResultadoReapertura({
  reabiertas,
  omitidas,
}: ResultadoReaperturaProps) {
  const ninguna = reabiertas === 0;
  const hayOmitidas = omitidas.length > 0;
  return (
    <div
      role="status"
      className={
        ninguna ? `${estilos.recuadro} ${estilos.ninguna}` : estilos.recuadro
      }
    >
      <strong className={estilos.titulo}>
        {ninguna
          ? REABRIR_LOTE.ningunaTitulo
          : REABRIR_LOTE.resultadoTitulo(reabiertas)}
      </strong>
      {ninguna && !hayOmitidas ? null : (
        <span className={estilos.resumen}>
          {ninguna
            ? REABRIR_LOTE.ningunaOmitidas(omitidas.length)
            : REABRIR_LOTE.resultadoTexto(omitidas.length)}
        </span>
      )}
      {hayOmitidas ? (
        <ul className={estilos.lista}>
          {omitidas.map((o) => (
            <li key={o.id} className={estilos.item}>
              <span className={estilos.descripcion}>
                {o.descripcion}{' '}
                <span className={estilos.referencia}>{o.referencia}</span>
              </span>
              <span className={estilos.razon}>
                {ETIQUETAS_RAZON_OMISION_REAPERTURA[o.razon]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
