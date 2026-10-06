import type { Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  ERROR_CONEXION,
  ERROR_DEMASIADO_GRANDE,
  ERROR_RECHAZO_CARGA,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/cargas/textos';

/**
 * Por qué falló la subida. Solo las clases que el mockup v23 dibuja: el texto
 * sale de la clase, nunca del servidor, salvo el motivo de un rechazo (400).
 */
export type FalloSubida =
  /** `detalle`: motivo del servidor, solo para mostrarlo como texto; `null` si no mandó ninguno. */
  | { clase: 'rechazo'; detalle: string | null }
  | { clase: 'demasiado_grande' }
  | { clase: 'sin_permiso' }
  | { clase: 'conexion' };

export interface AlertaSubidaProps {
  fallo: FalloSubida;
  /** Solo la conexión lo ofrece (mockup error_subida): volver a enviar lo mismo. */
  onReintentar?: () => void;
  /** Para mover el foco a la alerta cuando la subida falla. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Alerta de la tarjeta cuya subida falló. Reutiliza `AlertaError` (`role="alert"`,
 * enfocable por código). El motivo del 400 es el único texto ajeno que se
 * pinta, y como texto plano de React: nunca marcado.
 */
export function AlertaSubida({ fallo, onReintentar, ref }: AlertaSubidaProps) {
  switch (fallo.clase) {
    case 'rechazo':
      return (
        <AlertaError
          ref={ref}
          titulo={ERROR_RECHAZO_CARGA}
          detalle={fallo.detalle ?? undefined}
        />
      );
    case 'demasiado_grande':
      return <AlertaError ref={ref} {...ERROR_DEMASIADO_GRANDE} />;
    case 'sin_permiso':
      return <AlertaError ref={ref} {...ERROR_SIN_PERMISO} />;
    case 'conexion':
      return (
        <AlertaError
          ref={ref}
          {...ERROR_CONEXION}
          accion={
            onReintentar ? (
              <Button variante="secundario" onClick={onReintentar}>
                {REINTENTAR}
              </Button>
            ) : undefined
          }
        />
      );
  }
}
