import type { ReactNode, Ref } from 'react';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import {
  ETIQUETAS_ESTADO_BANDEJA,
  ETIQUETAS_ORIGEN_CONCILIACION,
} from '@/shared/dominio';
import type { OrigenConciliacion } from '@/shared/dominio';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { GLIFOS_ESTADO, VOLVER_A_BANDEJA } from '@/features/caso/textos';
import { EnlaceBandeja } from './EnlaceBandeja';
import estilos from './EncabezadoCaso.module.css';

export interface EncabezadoCasoProps {
  /** Estado derivado que decide el servidor; nunca el rol del usuario. */
  estado: EstadoBandeja;
  /** Regla de la propuesta expandida; `null` si el caso no tiene propuesta. */
  regla: string | null;
  /** Origen de la propuesta expandida; `null` si el caso no tiene propuesta. */
  origen: OrigenConciliacion | null;
  descripcion: string;
  /** Banner y alertas de la resolución: entre el enlace de regreso y el título. */
  avisos?: ReactNode;
  /** Para enfocar la descripción tras recargar el caso. */
  descripcionRef?: Ref<HTMLHeadingElement>;
}

/**
 * Enlace de regreso, chips de estado, regla y origen, y la descripción del
 * movimiento. El `h1` de la página es el del shell: la descripción es un `h2`
 * con el aspecto del título de la maqueta. Sin banco, cuenta ni perfil.
 */
export function EncabezadoCaso({
  estado,
  regla,
  origen,
  descripcion,
  avisos,
  descripcionRef,
}: EncabezadoCasoProps) {
  return (
    <>
      <EnlaceBandeja texto={VOLVER_A_BANDEJA} variante="atras" />
      {avisos}
      <header className={estilos.encabezado}>
        <div className={estilos.chips}>
          <EstadoChip tono={estado}>
            <span aria-hidden="true">{GLIFOS_ESTADO[estado]}</span>
            {ETIQUETAS_ESTADO_BANDEJA[estado]}
          </EstadoChip>
          {regla === null ? null : (
            <EstadoChip tono="neutral">
              <span className={estilos.mono}>{regla}</span>
            </EstadoChip>
          )}
          {origen === null ? null : (
            <EstadoChip tono="neutral">
              {ETIQUETAS_ORIGEN_CONCILIACION[origen]}
            </EstadoChip>
          )}
        </div>
        <h2 ref={descripcionRef} tabIndex={-1} className={estilos.titulo}>
          {descripcion}
        </h2>
      </header>
    </>
  );
}
