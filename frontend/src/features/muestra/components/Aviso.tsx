import type { ReactNode } from 'react';
import estilos from './Aviso.module.css';
import { IconoCheck, IconoDesacuerdo, IconoInfo } from './iconos';

export type TonoAviso = 'info' | 'ok' | 'ambar';

export interface AvisoProps {
  tono: TonoAviso;
  titulo: string;
  /** Líneas de apoyo bajo el título. */
  detalles?: readonly string[];
  /** Ícono propio; por omisión, el del tono. */
  icono?: 'desacuerdo';
  children?: ReactNode;
}

/** Aviso con ícono, título y detalle (info, correcto o ámbar). */
export function Aviso({
  tono,
  titulo,
  detalles = [],
  icono,
  children,
}: AvisoProps) {
  const Icono =
    icono === 'desacuerdo'
      ? IconoDesacuerdo
      : tono === 'ok'
        ? IconoCheck
        : IconoInfo;
  return (
    <div className={`${estilos.aviso} ${estilos[tono]}`} role="status">
      <Icono className={estilos.icono} />
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>{titulo}</strong>
        {detalles.map((d) => (
          <span key={d} className={estilos.detalle}>
            {d}
          </span>
        ))}
        {children}
      </div>
    </div>
  );
}
