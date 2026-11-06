import { Tabla, Th } from '@/shared/ui/Tabla';
import {
  CARGANDO,
  COLUMNAS,
  LOTE,
  NOMBRE_TABLA,
  ORDEN,
} from '@/features/bandeja/textos';
import { estaBloqueada, propuestaDeLote } from '@/features/bandeja/lote';
import { FilaBandeja, type FilaTabla } from './FilaBandeja';
import estilos from './TablaBandeja.module.css';

export type { FilaTabla } from './FilaBandeja';

/** Filas de relleno de la carga inicial (mockup: cinco). */
const FILAS_DE_RELLENO = 5;

export interface TablaBandejaProps {
  /** Filas en el orden en que llegaron del servidor: la tabla no reordena. */
  filas: readonly FilaTabla[];
  /** Primera carga: relleno con `aria-busy` y ninguna fila de datos. */
  cargando?: boolean;
  /** Modo lote (5.3): ids marcados y qué hacer al alternar uno. Ausente = normal. */
  lote?: {
    marcadas: ReadonlySet<string>;
    enviando: boolean;
    onAlternar: (id: string) => void;
  };
}

/**
 * Tabla de movimientos de la bandeja. Presentacional y de solo lectura: el
 * orden (por confianza, 5.1) es del servidor y el texto «Orden: confianza ↓»
 * se publica en el título accesible de la tabla, sin controles de orden.
 */
export function TablaBandeja({
  filas,
  cargando = false,
  lote,
}: TablaBandejaProps) {
  if (cargando) {
    return (
      <div className={estilos.esqueleto} aria-busy="true" aria-label={CARGANDO}>
        {Array.from({ length: FILAS_DE_RELLENO }, (_, i) => (
          <div key={i} className={estilos.barra} />
        ))}
      </div>
    );
  }

  return (
    <Tabla titulo={`${NOMBRE_TABLA}. ${ORDEN}`}>
      <thead>
        <tr>
          {lote ? (
            <Th>
              <span className="solo-lectores">{LOTE.columna}</span>
            </Th>
          ) : null}
          <Th>{COLUMNAS.fecha}</Th>
          <Th>{COLUMNAS.movimiento}</Th>
          <Th numerica>{COLUMNAS.monto}</Th>
          <Th>{COLUMNAS.estado}</Th>
          <Th>{COLUMNAS.regla}</Th>
          <Th>{COLUMNAS.cfdi}</Th>
          <Th numerica>{COLUMNAS.diferencia}</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => {
          const id = propuestaDeLote(fila);
          return (
            <FilaBandeja
              key={fila.movimientoId}
              fila={fila}
              lote={
                lote
                  ? {
                      conCasilla: id !== null,
                      marcada: id !== null && lote.marcadas.has(id),
                      deshabilitada: lote.enviando || estaBloqueada(fila),
                      onAlternar: () => {
                        if (id !== null) lote.onAlternar(id);
                      },
                    }
                  : undefined
              }
            />
          );
        })}
      </tbody>
    </Tabla>
  );
}
