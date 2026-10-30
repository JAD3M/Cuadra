import type { Ref } from 'react';
import { Link } from 'react-router';
import type { ConteoClases } from '@/shared/dominio';
import {
  BANNER_ACEPTADA,
  BANNER_RECHAZADA,
  IR_A_BANDEJA,
} from '@/features/vista-previa/textos';
import { EnlaceCargas } from './EnlaceCargas';
import estilos from './BannerDecision.module.css';
import enlaces from './enlaces.module.css';

export interface BannerDecisionProps {
  /** La decisión que el servidor aceptó. */
  accion: 'aceptar' | 'rechazar';
  /** Qué pasó con cada clase, según el servidor; ausente = sin cifras. */
  conteo?: ConteoClases;
  /** Para mover el foco al banner cuando la decisión termina. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lo que pasó tras decidir. Región de estado (anuncio cortés) con
 * `tabIndex={-1}` para enfocarla desde código. Verde al aceptar, ámbar al
 * rechazar; los enlaces son `<a>` reales.
 */
export function BannerDecision({ accion, conteo, ref }: BannerDecisionProps) {
  const aceptada = accion === 'aceptar';
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={`${estilos.banner} ${aceptada ? estilos.aceptada : estilos.rechazada}`}
    >
      <strong className={estilos.titulo}>
        {aceptada ? BANNER_ACEPTADA.titulo : BANNER_RECHAZADA.titulo}
      </strong>
      <span className={estilos.detalle}>
        {aceptada ? BANNER_ACEPTADA.detalle(conteo) : BANNER_RECHAZADA.detalle}
      </span>
      <div className={estilos.enlaces}>
        {aceptada ? (
          <Link className={enlaces.enlace} to="/bandeja">
            {IR_A_BANDEJA}
          </Link>
        ) : null}
        <EnlaceCargas variante="enlace" />
      </div>
    </div>
  );
}
