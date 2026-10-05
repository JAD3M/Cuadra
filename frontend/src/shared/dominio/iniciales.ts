const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

/**
 * Iniciales de una razón social para el mosaico de la empresa: la primera
 * letra de las dos primeras palabras que no sean conectores, en mayúscula.
 * Una sola palabra da una sola letra; un texto vacío, una cadena vacía.
 */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(
      (palabra) => palabra !== '' && !CONECTORES.has(palabra.toLowerCase()),
    )
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}
