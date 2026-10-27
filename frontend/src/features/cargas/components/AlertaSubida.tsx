import type { Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  ERROR_CONEXION,
  ERROR_DEMASIADO_GRANDE,
  ERROR_OTRO,
  ERROR_RECHAZO_CARGA,
  ERROR_SIN_PERMISO,
  REINTENTAR,
  TEXTO_MONEDA_NO_MXN,
} from '@/features/cargas/textos';

/**
 * Por qué falló la subida. Las clases que el mockup v25 dibuja: el texto
 * sale de la clase, nunca del servidor, salvo el motivo de un rechazo (400).
 */
export type FalloSubida =
  /** `detalle`: motivo del servidor, solo para mostrarlo como texto; `null` si no mandó ninguno. */
  | { clase: 'rechazo'; detalle: string | null }
  /** 400 `moneda_no_mxn`: el estado de cuenta no está en pesos. */
  | { clase: 'moneda_no_mxn' }
  | { clase: 'demasiado_grande' }
  | { clase: 'sin_permiso' }
  | { clase: 'conexion' }
  /** 500 o cualquier fallo inesperado: sin Reintentar. */
  | { clase: 'otro' };

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
    case 'moneda_no_mxn':
      return <AlertaError ref={ref} {...TEXTO_MONEDA_NO_MXN} />;
    case 'demasiado_grande':
      return <AlertaError ref={ref} {...ERROR_DEMASIADO_GRANDE} />;
    case 'sin_permiso':
      return <AlertaError ref={ref} {...ERROR_SIN_PERMISO} />;
    case 'otro':
      return <AlertaError ref={ref} {...ERROR_OTRO} />;
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
