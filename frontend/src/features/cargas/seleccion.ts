import { LIMITES_CARGA } from '@/shared/dominio';

// Validación local de lo que el usuario elige o suelta. Es solo comodidad: el
// servidor vuelve a validar todo y decide. Nunca lee el contenido ni el tipo
// MIME (`file.type`): el navegador lo deduce de la extensión y el servidor no
// confía en él, así que aquí tampoco.

/** Por qué un archivo no se sube; `null` en `ArchivoEvaluado` = va. */
export type MotivoRechazo = 'extension' | 'tamano' | 'cantidad' | 'total';

export interface ArchivoEvaluado<T> {
  archivo: T;
  motivo: MotivoRechazo | null;
}

export interface ReglasSeleccion {
  /** Con el punto, en minúsculas: `.xml`. */
  extension: string;
  maxBytesPorArchivo: number;
  /** Sin tope si falta (el estado de cuenta es un solo archivo). */
  maxArchivos?: number;
  maxBytesTotal?: number;
}

export const REGLAS_CFDI: ReglasSeleccion = {
  extension: LIMITES_CARGA.cfdi.extension,
  maxArchivos: LIMITES_CARGA.cfdi.maxArchivos,
  maxBytesPorArchivo: LIMITES_CARGA.cfdi.maxBytesPorArchivo,
  maxBytesTotal: LIMITES_CARGA.cfdi.maxBytesTotal,
};

export const REGLAS_ESTADO_CUENTA: ReglasSeleccion = {
  extension: LIMITES_CARGA.estadoCuenta.extension,
  maxBytesPorArchivo: LIMITES_CARGA.estadoCuenta.maxBytesPorArchivo,
};

/** El PDF de BBVA (historia 3.2): un solo `.pdf` de hasta 10 MB. */
export const REGLAS_ESTADO_CUENTA_PDF: ReglasSeleccion = {
  extension: LIMITES_CARGA.estadoCuentaPdf.extension,
  maxBytesPorArchivo: LIMITES_CARGA.estadoCuentaPdf.maxBytesPorArchivo,
};

/**
 * Evalúa cada archivo en el orden elegido. Primero la extensión y el tamaño
 * propio; después, solo entre los que siguen en pie, el tope de cantidad y el
 * de bytes acumulados. Un archivo rechazado por extensión o tamaño no gasta
 * cantidad ni bytes, así que no le quita su lugar a uno válido.
 */
export function evaluarSeleccion<T extends { name: string; size: number }>(
  archivos: readonly T[],
  reglas: ReglasSeleccion,
): ArchivoEvaluado<T>[] {
  let aceptados = 0;
  let bytes = 0;
  return archivos.map((archivo) => {
    const motivo = motivoDe(archivo, reglas, aceptados, bytes);
    if (motivo === null) {
      aceptados += 1;
      bytes += archivo.size;
    }
    return { archivo, motivo };
  });
}

function motivoDe(
  { name, size }: { name: string; size: number },
  reglas: ReglasSeleccion,
  aceptados: number,
  bytes: number,
): MotivoRechazo | null {
  if (!name.toLowerCase().endsWith(reglas.extension)) return 'extension';
  if (size > reglas.maxBytesPorArchivo) return 'tamano';
  if (reglas.maxArchivos !== undefined && aceptados + 1 > reglas.maxArchivos) {
    return 'cantidad';
  }
  if (
    reglas.maxBytesTotal !== undefined &&
    bytes + size > reglas.maxBytesTotal
  ) {
    return 'total';
  }
  return null;
}
