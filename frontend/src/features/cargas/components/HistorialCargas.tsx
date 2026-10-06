import { useId } from 'react';
import { HISTORIAL } from '@/features/cargas/textos';
import type { VistaHistorial } from '@/features/cargas/vista';
import { ErrorCargas } from './ErrorCargas';
import { EsqueletoCargas } from './EsqueletoCargas';
import estilos from './HistorialCargas.module.css';
import { TablaCargas, type FilaHistorial } from './TablaCargas';
import { VacioCargas } from './VacioCargas';

export interface HistorialCargasProps {
  /** Qué mostrar; `null` (401 o cancelación) deja solo el encabezado. */
  vista: VistaHistorial | null;
  cargas: readonly FilaHistorial[];
  onReintentar?: () => void;
}

/** Sección «Cargas recientes»: la tabla o el estado que la sustituye. */
export function HistorialCargas({
  vista,
  cargas,
  onReintentar,
}: HistorialCargasProps) {
  const idTitulo = useId();
  return (
    <section className={estilos.historial} aria-labelledby={idTitulo}>
      <div className={estilos.cabecera}>
        <h2 id={idTitulo} className={estilos.titulo}>
          {HISTORIAL.titulo}
        </h2>
      </div>
      {vista === 'cargando' ? <EsqueletoCargas /> : null}
      {vista === 'vacio' ? <VacioCargas /> : null}
      {vista === 'tabla' ? <TablaCargas cargas={cargas} /> : null}
      {vista === 'fallo' || vista === 'sin_permiso' ? (
        <ErrorCargas tipo={vista} onReintentar={onReintentar} />
      ) : null}
    </section>
  );
}
