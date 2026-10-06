import { Tabla, Th } from '@/shared/ui/Tabla';
import { COLUMNAS_CARGAS, HISTORIAL } from '@/features/cargas/textos';
import { FilaCarga, type FilaHistorial } from './FilaCarga';
import estilos from './TablaCargas.module.css';

export type { FilaHistorial } from './FilaCarga';

export interface TablaCargasProps {
  /** Filas en el orden en que llegaron del servidor: la tabla no reordena. */
  cargas: readonly FilaHistorial[];
}

/**
 * Tabla del historial. Presentacional y de solo lectura: el orden (la más
 * nueva primero) es del servidor y las filas no se pueden abrir.
 */
export function TablaCargas({ cargas }: TablaCargasProps) {
  return (
    <Tabla titulo={HISTORIAL.nombreTabla}>
      <thead>
        <tr>
          <Th>{COLUMNAS_CARGAS.tipo}</Th>
          <Th>{COLUMNAS_CARGAS.archivo}</Th>
          <Th>{COLUMNAS_CARGAS.estado}</Th>
          <Th className={estilos.avance}>{COLUMNAS_CARGAS.avance}</Th>
          <Th numerica>{COLUMNAS_CARGAS.validos}</Th>
          <Th numerica>{COLUMNAS_CARGAS.conError}</Th>
          <Th>{COLUMNAS_CARGAS.subio}</Th>
          <Th>{COLUMNAS_CARGAS.fecha}</Th>
        </tr>
      </thead>
      <tbody>
        {cargas.map((carga) => (
          <FilaCarga key={carga.id} carga={carga} />
        ))}
      </tbody>
    </Tabla>
  );
}
