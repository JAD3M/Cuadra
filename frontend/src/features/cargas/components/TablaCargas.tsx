import { useState } from 'react';
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
 * Tabla del historial. El orden (la más nueva primero) es del servidor. Solo
 * las filas rechazadas se abren, de una en una, para ver el motivo (3.7).
 */
export function TablaCargas({ cargas }: TablaCargasProps) {
  // Una sola fila abierta a la vez (historia 3.7).
  const [abierta, setAbierta] = useState<string | null>(null);
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
          <FilaCarga
            key={carga.id}
            carga={carga}
            abierta={abierta === carga.id}
            onAlternar={() =>
              setAbierta((actual) => (actual === carga.id ? null : carga.id))
            }
          />
        ))}
      </tbody>
    </Tabla>
  );
}
