import type { ReactNode, Ref } from 'react';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import {
  ETIQUETAS_ESTADO_BANDEJA,
  ETIQUETAS_ORIGEN_CONCILIACION,
} from '@/shared/dominio';
import type { OrigenConciliacion } from '@/shared/dominio';
import {
  ETIQUETA_REQUIERE_REVISION,
  GLIFO_REQUIERE_REVISION,
} from '@/shared/dominio/etiquetas';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import {
  DESCARTADO,
  GLIFOS_ESTADO,
  VOLVER_A_BANDEJA,
} from '@/features/caso/textos';
import { EnlaceBandeja } from './EnlaceBandeja';
import estilos from './EncabezadoCaso.module.css';

export interface EncabezadoCasoProps {
  /** Estado derivado que decide el servidor; nunca el rol del usuario. */
  estado: EstadoBandeja;
  /** Conciliado con la factura cancelada: el chip pide revisión (4.6). */
  requiereRevision?: boolean;
  /** Regla de la propuesta expandida; `null` si el caso no tiene propuesta. */
  regla: string | null;
  /** Origen de la propuesta expandida; `null` si el caso no tiene propuesta. */
  origen: OrigenConciliacion | null;
  descripcion: string;
  /** Movimiento descartado: chip propio y sin chips de regla ni origen. */
  descartado?: boolean;
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
  requiereRevision = false,
  regla,
  origen,
  descripcion,
  descartado = false,
  avisos,
  descripcionRef,
}: EncabezadoCasoProps) {
  return (
    <>
      <EnlaceBandeja texto={VOLVER_A_BANDEJA} variante="atras" />
      {avisos}
      <header className={estilos.encabezado}>
        <div className={estilos.chips}>
          {descartado ? (
            <EstadoChip tono="neutral">
              <span aria-hidden="true">{DESCARTADO.glifo}</span>
              {DESCARTADO.titulo}
            </EstadoChip>
          ) : requiereRevision ? (
            <EstadoChip tono="sin_match">
              <span aria-hidden="true">{GLIFO_REQUIERE_REVISION}</span>
              {ETIQUETA_REQUIERE_REVISION}
            </EstadoChip>
          ) : (
            <EstadoChip tono={estado}>
              <span aria-hidden="true">{GLIFOS_ESTADO[estado]}</span>
              {ETIQUETAS_ESTADO_BANDEJA[estado]}
            </EstadoChip>
          )}
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
