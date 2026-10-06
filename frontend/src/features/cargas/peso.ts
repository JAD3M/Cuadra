// Peso de un archivo para las filas de la selección. Solo aritmética entera:
// el tamaño llega en bytes enteros y las décimas se calculan con el resto de
// la división, sin pasar por coma flotante ni por `Date`/`Intl`.

const KB = 1024;
const MB = KB * KB;

/** Cociente entero de `numerador / divisor`: el resto se resta antes de dividir. */
function cocienteEntero(numerador: number, divisor: number): number {
  return (numerador - (numerador % divisor)) / divisor;
}

/**
 * `14 KB`, `3.4 MB`: menos de 1 KB en bytes, hasta 1 MB en KB enteros y desde
 * ahí en MB con una décima. Redondea al más cercano (mitad hacia arriba). Un
 * tamaño que redondea a 1024 KB se muestra como `1.0 MB`.
 */
export function formatearPeso(bytes: number): string {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new RangeError('El peso debe ser un entero de bytes no negativo.');
  }
  if (bytes < KB) return `${bytes} B`;
  const kilobytes = cocienteEntero(bytes + KB / 2, KB);
  if (kilobytes < KB) return `${kilobytes} KB`;
  const decimas = cocienteEntero(bytes * 10 + MB / 2, MB);
  return `${cocienteEntero(decimas, 10)}.${decimas % 10} MB`;
}
