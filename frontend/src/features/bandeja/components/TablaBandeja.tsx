import { Tabla, Th } from '@/shared/ui/Tabla';
import {
  CARGANDO,
  COLUMNAS,
  NOMBRE_TABLA,
  ORDEN,
} from '@/features/bandeja/textos';
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
}

/**
 * Tabla de movimientos de la bandeja. Presentacional y de solo lectura: el
 * orden (monto de mayor a menor) es del servidor y el texto «Orden: monto ↓»
 * se publica en el título accesible de la tabla, sin controles de orden.
 */
export function TablaBandeja({ filas, cargando = false }: TablaBandejaProps) {
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
        {filas.map((fila) => (
          <FilaBandeja key={fila.movimientoId} fila={fila} />
        ))}
      </tbody>
    </Tabla>
  );
}
