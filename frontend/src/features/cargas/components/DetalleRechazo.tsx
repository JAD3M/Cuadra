import type { ReactNode } from 'react';
import { useDetalleCarga } from '@/features/cargas/useDetalleCarga';
import { MOTIVO_RECHAZO } from '@/features/cargas/textos';
import estilos from './FilaCarga.module.css';

export interface DetalleRechazoProps {
  cargaId: string;
}

/**
 * Contenido de la fila abierta de una carga rechazada: el motivo que el
 * listado no trae y que se pide a `GET /cargas/:id` al abrir. El motivo es
 * texto plano que se parte dentro de su contenedor.
 */
export function DetalleRechazo({ cargaId }: DetalleRechazoProps) {
  const consulta = useDetalleCarga(cargaId, true);
  const datos = consulta.data;
  let cuerpo: ReactNode;
  if (datos !== undefined) {
    const motivo = datos.motivoRechazo ?? null;
    cuerpo = (
      <span className={motivo === null ? estilos.sinMotivo : estilos.motivo}>
        {motivo ?? MOTIVO_RECHAZO.vacio}
      </span>
    );
  } else if (consulta.isError) {
    cuerpo = (
      <span role="alert" className={estilos.motivo}>
        {MOTIVO_RECHAZO.error}
      </span>
    );
  } else {
    cuerpo = (
      <span role="status" className={estilos.sinMotivo}>
        {MOTIVO_RECHAZO.cargando}
      </span>
    );
  }
  return (
    <div className={estilos.contenidoDetalle}>
      <span className={estilos.etiquetaMotivo}>{MOTIVO_RECHAZO.etiqueta}</span>
      {cuerpo}
    </div>
  );
}
