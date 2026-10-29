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
  TITULO_PDF_LINEAS_NO_LEIDAS,
  TITULO_PDF_SALDOS_NO_CUADRAN,
  TITULO_PDF_SIN_MOVIMIENTOS,
  TEXTO_MONEDA_NO_MXN,
  TEXTO_PDF_ILEGIBLE,
  TEXTO_PDF_SIN_TEXTO,
} from '@/features/cargas/textos';
import { DetalleRechazoPdf, type LineaNoLeida } from './DetalleRechazoPdf';

/**
 * Por qué falló la subida. Las clases que el mockup v25 dibuja: el texto
 * sale de la clase, nunca del servidor, salvo el motivo de un rechazo (400).
 */
export type FalloSubida =
  /** `detalle`: motivo del servidor, solo para mostrarlo como texto; `null` si no mandó ninguno. */
  | { clase: 'rechazo'; detalle: string | null }
  /** 400 `moneda_no_mxn`: el estado de cuenta no está en pesos. */
  | { clase: 'moneda_no_mxn' }
  /** 400 `pdf_sin_texto`: el PDF es una imagen, sin texto. */
  | { clase: 'pdf_sin_texto' }
  /** 400 `pdf_ilegible`: el PDF no tiene el formato del banco. */
  | { clase: 'pdf_ilegible' }
  /** 400 `saldos_no_cuadran`: `mensaje` es el del servidor; los montos, cadenas. */
  | {
      clase: 'pdf_saldos_no_cuadran';
      mensaje: string | null;
      saldoFinal?: string;
      saldoEsperado: string;
      diferencia: string;
      lineas: LineaNoLeida[];
    }
  /** 400 `lineas_no_leidas`. */
  | {
      clase: 'pdf_lineas_no_leidas';
      mensaje: string | null;
      lineas: LineaNoLeida[];
    }
  /** 400 `sin_movimientos`. */
  | { clase: 'pdf_sin_movimientos'; mensaje: string | null }
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
    case 'pdf_sin_texto':
      return <AlertaError ref={ref} {...TEXTO_PDF_SIN_TEXTO} />;
    case 'pdf_ilegible':
      return <AlertaError ref={ref} {...TEXTO_PDF_ILEGIBLE} />;
    case 'pdf_saldos_no_cuadran':
      return (
        <AlertaError
          ref={ref}
          titulo={TITULO_PDF_SALDOS_NO_CUADRAN}
          detalle={fallo.mensaje ?? undefined}
          accion={
            <DetalleRechazoPdf
              saldos={{
                ...(fallo.saldoFinal === undefined
                  ? {}
                  : { saldoFinal: fallo.saldoFinal }),
                saldoEsperado: fallo.saldoEsperado,
                diferencia: fallo.diferencia,
              }}
              lineas={fallo.lineas}
            />
          }
        />
      );
    case 'pdf_lineas_no_leidas':
      return (
        <AlertaError
          ref={ref}
          titulo={TITULO_PDF_LINEAS_NO_LEIDAS}
          detalle={fallo.mensaje ?? undefined}
          accion={<DetalleRechazoPdf lineas={fallo.lineas} />}
        />
      );
    case 'pdf_sin_movimientos':
      return (
        <AlertaError
          ref={ref}
          titulo={TITULO_PDF_SIN_MOVIMIENTOS}
          detalle={fallo.mensaje ?? undefined}
        />
      );
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
