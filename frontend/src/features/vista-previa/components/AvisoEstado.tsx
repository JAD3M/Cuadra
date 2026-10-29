import type { Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import {
  ERROR_SIN_PERMISO,
  NO_ENCONTRADA,
  YA_RESUELTA,
} from '@/features/vista-previa/textos';
import { EnlaceCargas } from './EnlaceCargas';
import estilos from './AvisoEstado.module.css';

/** No existe para esta persona (404): centrado, con salida a Cargas. */
export function NoEncontrada() {
  return (
    <div className={estilos.centrado}>
      <strong className={estilos.titulo}>{NO_ENCONTRADA.titulo}</strong>
      <span className={estilos.detalle}>{NO_ENCONTRADA.detalle}</span>
      <EnlaceCargas variante="salida" />
    </div>
  );
}

export interface AvisoConFocoProps {
  /** Para mover el foco a la alerta cuando aparece tras una acción. */
  ref?: Ref<HTMLDivElement>;
}

/** La carga ya salió de la espera (409): alerta con salida a Cargas. */
export function YaResuelta({ ref }: AvisoConFocoProps) {
  return (
    <AlertaError
      ref={ref}
      titulo={YA_RESUELTA.titulo}
      detalle={YA_RESUELTA.detalle}
      accion={<EnlaceCargas variante="salida" />}
    />
  );
}

/** El servidor negó el acceso (403); nunca se muestra su texto. */
export function SinPermiso({ ref }: AvisoConFocoProps) {
  return (
    <AlertaError
      ref={ref}
      titulo={ERROR_SIN_PERMISO.titulo}
      detalle={ERROR_SIN_PERMISO.detalle}
    />
  );
}
