import { ApiError, NetworkError } from '@/shared/api';
import {
  cuerpoLineasNoLeidas,
  cuerpoSaldosNoCuadran,
  type LineaNoLeida,
} from '@/shared/api/contratos';

// Clasificadores propios de Cargas: `mensajeDeError` no distingue un rechazo
// (400) de un 413 y sirve a otras pantallas, así que no se toca. Devuelven solo
// una clase; el texto sale de `textos.ts` y de los textos compartidos de la
// bandeja. El único texto del servidor que se conserva es el motivo de un 400,
// y se muestra como texto plano.

/** Código `error` del 400 que rechaza un estado de cuenta que no es MXN. */
export const CODIGO_MONEDA_NO_MXN = 'moneda_no_mxn';

/** Códigos `error` del 400 de la lectura de un PDF (historia 3.2). */
export const CODIGO_PDF_SIN_TEXTO = 'pdf_sin_texto';
export const CODIGO_PDF_ILEGIBLE = 'pdf_ilegible';
/** Códigos `error` de los rechazos de la historia 3.3. */
export const CODIGO_SALDOS_NO_CUADRAN = 'saldos_no_cuadran';
export const CODIGO_LINEAS_NO_LEIDAS = 'lineas_no_leidas';
export const CODIGO_SIN_MOVIMIENTOS = 'sin_movimientos';

export type ClaseErrorSubida =
  /** `detalle`: motivo del servidor; `null` si no mandó ninguno. */
  | { clase: 'rechazo'; detalle: string | null }
  /** 400 `moneda_no_mxn`: el estado de cuenta no está en pesos (historia 3.1). */
  | { clase: 'moneda_no_mxn' }
  /** 400 `pdf_sin_texto`: el PDF es una imagen escaneada, sin texto (historia 3.2). */
  | { clase: 'pdf_sin_texto' }
  /** 400 `pdf_ilegible`: el PDF no tiene el formato del banco (historia 3.2). */
  | { clase: 'pdf_ilegible' }
  /** 400 `saldos_no_cuadran` (historia 3.3): `mensaje` es el del servidor. */
  | {
      clase: 'pdf_saldos_no_cuadran';
      mensaje: string | null;
      /** Decimales en cadena, nunca `number`. */
      saldoFinal?: string;
      saldoEsperado: string;
      diferencia: string;
      lineas: LineaNoLeida[];
    }
  /** 400 `lineas_no_leidas` (historia 3.3). */
  | {
      clase: 'pdf_lineas_no_leidas';
      mensaje: string | null;
      lineas: LineaNoLeida[];
    }
  /** 400 `sin_movimientos` (historia 3.3). */
  | { clase: 'pdf_sin_movimientos'; mensaje: string | null }
  | { clase: 'demasiado_grande' }
  | { clase: 'sin_permiso' }
  | { clase: 'conexion' }
  | { clase: 'otro' };

export type ErrorLecturaCargas = 'sin_permiso' | 'conexion';

/**
 * Los rechazos de la historia 3.3 que traen datos en el cuerpo. Si el cuerpo
 * no cumple lo esperado devuelve `null` y el 400 se trata como un rechazo
 * genérico con el motivo del servidor.
 */
function clasificarRechazoPdf(
  error: ApiError,
  mensaje: string | null,
): ClaseErrorSubida | null {
  switch (error.error) {
    case CODIGO_SALDOS_NO_CUADRAN: {
      const cuerpo = cuerpoSaldosNoCuadran.safeParse(error.cuerpo);
      if (!cuerpo.success) return null;
      const { saldoFinal, saldoEsperado, diferencia, lineasNoLeidas } =
        cuerpo.data;
      return {
        clase: 'pdf_saldos_no_cuadran',
        mensaje,
        ...(saldoFinal === undefined ? {} : { saldoFinal }),
        saldoEsperado,
        diferencia,
        lineas: lineasNoLeidas,
      };
    }
    case CODIGO_LINEAS_NO_LEIDAS: {
      const cuerpo = cuerpoLineasNoLeidas.safeParse(error.cuerpo);
      if (!cuerpo.success) return null;
      return {
        clase: 'pdf_lineas_no_leidas',
        mensaje,
        lineas: cuerpo.data.lineasNoLeidas,
      };
    }
    case CODIGO_SIN_MOVIMIENTOS:
      return { clase: 'pdf_sin_movimientos', mensaje };
    default:
      return null;
  }
}

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de una subida. `null` para una cancelación y para un 401: ni
 * uno ni otro muestran mensaje (el 401 lo atiende la capa de sesión). El 413 se
 * decide por el código, nunca por la forma del cuerpo (un proxy responde HTML).
 */
export function clasificarErrorSubida(error: unknown): ClaseErrorSubida | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 400: {
        if (error.error === CODIGO_MONEDA_NO_MXN) {
          return { clase: 'moneda_no_mxn' };
        }
        if (error.error === CODIGO_PDF_SIN_TEXTO) {
          return { clase: 'pdf_sin_texto' };
        }
        if (error.error === CODIGO_PDF_ILEGIBLE) {
          return { clase: 'pdf_ilegible' };
        }
        // class-validator puede devolver varios mensajes (M8).
        const detalle = error.mensajes.join(' ').trim();
        const rechazoPdf = clasificarRechazoPdf(
          error,
          detalle === '' ? null : detalle,
        );
        if (rechazoPdf !== null) return rechazoPdf;
        return { clase: 'rechazo', detalle: detalle === '' ? null : detalle };
      }
      case 413:
        return { clase: 'demasiado_grande' };
      case 403:
        return { clase: 'sin_permiso' };
      default:
        return { clase: 'otro' };
    }
  }
  if (error instanceof NetworkError) {
    return { clase: 'conexion' };
  }
  return { clase: 'otro' };
}

/**
 * Clase del fallo de una lectura (lista, detalle, perfiles), igual que CU-23:
 * 403 sin permiso, 401 y cancelación sin mensaje, el resto conexión.
 */
export function clasificarErrorLectura(
  error: unknown,
): ErrorLecturaCargas | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return null;
    if (error.statusCode === 403) return 'sin_permiso';
  }
  return 'conexion';
}
