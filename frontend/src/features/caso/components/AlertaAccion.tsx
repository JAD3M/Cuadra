import type { Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { ERROR_CONEXION, ERROR_SIN_PERMISO } from '@/features/bandeja/textos';
import {
  ERRORES,
  RECARGAR_CASO,
  VOLVER_A_BANDEJA_ACCION,
} from '@/features/caso/textos';
import { EnlaceBandeja } from './EnlaceBandeja';

/**
 * Clase del fallo de una acción. El 400 por motivo largo no es una alerta: se
 * muestra bajo el campo del motivo, así que no está aquí.
 */
export type TipoAlertaAccion =
  | 'segregacion'
  | 'sin_permiso'
  | 'conflicto'
  | 'no_encontrado'
  | 'conexion'
  | 'contrato'
  | 'generico';

export interface AlertaAccionProps {
  tipo: TipoAlertaAccion;
  /** «Recargar caso» (409): solo al hacer clic, nunca por sí sola. */
  onRecargar?: () => void;
  /** Para mover el foco a la alerta cuando la acción falla. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Alerta dentro de «Tu decisión» cuando confirmar o rechazar falla. El texto
 * sale de la clase del error, nunca del servidor: ni el código interno del
 * 403 ni ningún mensaje ajeno llegan a la pantalla.
 */
export function AlertaAccion({ tipo, onRecargar, ref }: AlertaAccionProps) {
  switch (tipo) {
    case 'segregacion':
      return <AlertaError ref={ref} {...ERRORES.segregacion} />;
    case 'sin_permiso':
      return <AlertaError ref={ref} {...ERROR_SIN_PERMISO} />;
    case 'contrato':
      return <AlertaError ref={ref} {...ERRORES.contrato} />;
    case 'no_encontrado':
      return (
        <AlertaError
          ref={ref}
          {...ERRORES.noEncontrado}
          accion={
            <EnlaceBandeja texto={VOLVER_A_BANDEJA_ACCION} variante="accion" />
          }
        />
      );
    case 'conflicto':
      return (
        <AlertaError
          ref={ref}
          {...ERRORES.conflicto}
          accion={
            onRecargar ? (
              <Button variante="secundario" onClick={onRecargar}>
                {RECARGAR_CASO}
              </Button>
            ) : undefined
          }
        />
      );
    case 'conexion':
    case 'generico':
      // Sin texto propio para «otro 4xx»: se usa el de conectividad aprobado
      // y los controles quedan habilitados para reintentar.
      return <AlertaError ref={ref} {...ERROR_CONEXION} />;
  }
}
