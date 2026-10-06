// Constructores de los cuerpos multipart de las dos subidas. Los nombres de las
// partes son los del backend: `archivos` (CFDI) y `archivo`, `banco`, `cuenta`,
// `perfil` (estado de cuenta). No validan nada: la selección ya se evaluó y el
// servidor es quien decide.

/** CFDI: una parte `archivos` por XML y ninguna otra. */
export function construirFormCfdi(archivos: readonly File[]): FormData {
  const form = new FormData();
  for (const archivo of archivos) form.append('archivos', archivo);
  return form;
}

export interface DatosEstadoCuenta {
  archivo: File;
  banco: string;
  cuenta: string;
  /** `null` cuando no hay perfil elegido (p. ej. la lista de perfiles falló). */
  perfil: string | null;
}

/**
 * Estado de cuenta: `archivo` siempre. `banco` y `cuenta` solo si traen algo
 * más que espacios, y se envían tal como se escribieron (sin recortar).
 * `perfil` solo si hay uno elegido.
 */
export function construirFormEstadoCuenta(datos: DatosEstadoCuenta): FormData {
  const form = new FormData();
  form.append('archivo', datos.archivo);
  if (datos.banco.trim() !== '') form.append('banco', datos.banco);
  if (datos.cuenta.trim() !== '') form.append('cuenta', datos.cuenta);
  if (datos.perfil !== null) form.append('perfil', datos.perfil);
  return form;
}
