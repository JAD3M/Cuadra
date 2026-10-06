import type { Ref } from 'react';
import { ACCION_CONFIRMAR, type AccionResolucion } from '@/shared/dominio';
import { BANNER } from '@/features/caso/textos';
import estilos from './BannerResolucion.module.css';

export interface BannerResolucionProps {
  /** La acción que el servidor aceptó. */
  accion: AccionResolucion;
  /** «{usuario} · {fecha}» del caso vuelto a pedir; `null` si no se conoce. */
  detalle: string | null;
  /** Nota sobre las demás propuestas; `null` si no corresponde. */
  nota: string | null;
  /** Para mover el foco al banner cuando la resolución termina. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Aviso tras confirmar o rechazar. Es una región de estado (anuncio cortés,
 * no interrumpe) con `tabIndex={-1}` para enfocarla desde código. No navega
 * ni ofrece acciones: el texto ya viene decidido por la respuesta y el caso.
 */
export function BannerResolucion({
  accion,
  detalle,
  nota,
  ref,
}: BannerResolucionProps) {
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={`${estilos.banner} ${
        accion === ACCION_CONFIRMAR ? estilos.confirmado : estilos.rechazado
      }`}
    >
      <strong className={estilos.titulo}>
        {accion === ACCION_CONFIRMAR ? BANNER.confirmado : BANNER.rechazado}
      </strong>
      {detalle === null ? null : (
        <span className={estilos.detalle}>{detalle}</span>
      )}
      {nota === null ? null : <span className={estilos.detalle}>{nota}</span>}
    </div>
  );
}
