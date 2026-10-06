import type { Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/bandeja/textos';
import { ERRORES, VOLVER_A_BANDEJA_ACCION } from '@/features/caso/textos';
import { EnlaceBandeja } from './EnlaceBandeja';
import estilos from './ErrorCaso.module.css';

export type TipoErrorCaso =
  'conexion' | 'contrato' | 'no_encontrado' | 'sin_permiso';

export interface ErrorCasoProps {
  tipo: TipoErrorCaso;
  /** Solo para los fallos que se pueden reintentar (conexión y contrato). */
  onReintentar?: () => void;
  /** Para mover el foco al fallo cuando aparece. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Fallo de la lectura del caso, con el copy de la maqueta: nunca muestra
 * texto, id ni empresa del servidor. «No encontrado» es un bloque centrado
 * con la salida a la bandeja; los demás son una alerta.
 */
export function ErrorCaso({ tipo, onReintentar, ref }: ErrorCasoProps) {
  if (tipo === 'no_encontrado') {
    return (
      <div ref={ref} tabIndex={-1} className={estilos.vacio}>
        <strong className={estilos.titulo}>
          {ERRORES.noEncontrado.titulo}
        </strong>
        <span className={estilos.detalle}>{ERRORES.noEncontrado.detalle}</span>
        <EnlaceBandeja texto={VOLVER_A_BANDEJA_ACCION} variante="accion" />
      </div>
    );
  }
  const texto =
    tipo === 'contrato'
      ? ERRORES.contrato
      : tipo === 'sin_permiso'
        ? ERROR_SIN_PERMISO
        : ERROR_CONEXION;
  const reintentable = tipo === 'conexion' || tipo === 'contrato';
  return (
    <AlertaError
      ref={ref}
      titulo={texto.titulo}
      detalle={texto.detalle}
      accion={
        reintentable && onReintentar ? (
          <Button variante="secundario" onClick={onReintentar}>
            {REINTENTAR}
          </Button>
        ) : undefined
      }
    />
  );
}
