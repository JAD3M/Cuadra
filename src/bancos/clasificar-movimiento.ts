import type { ClaseMovimiento } from '../common/entities/tipos';

/**
 * Historia 6.3 (FR-69, AD-8). Función pura: la descripción y el monto de un
 * movimiento importado dan su clase, o nada. Solo sirve para medir cuántos son
 * comisiones o parcialidades; no cambia la conciliación ni cierra nada.
 *
 * Criterios iniciales (SUPUESTO: se afinan con PDFs reales), sobre la
 * descripción en mayúsculas y sin acentos. Son los mismos para todo banco: el
 * lector entrega la descripción tal como viene y cada banco que muestre una
 * redacción distinta suma aquí su palabra, con su prueba.
 *  - `comision`: un cargo (monto negativo) cuya descripción contiene «COMISION».
 *  - `parcialidad`: un abono (monto positivo) cuya descripción contiene
 *    «PARCIALIDAD», «PAGO PARCIAL» o «ABONO PARCIAL».
 * El signo manda: un abono que dice «comisión» es una devolución, y un cargo
 * que dice «parcialidad» es dinero que sale. Ninguno se clasifica.
 */
export function clasificarMovimiento(
  descripcion: string,
  monto: string,
): ClaseMovimiento | null {
  const texto = descripcion.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  // El monto viaja como texto con signo: nunca pasa por Number.
  const esCargo = monto.trim().startsWith('-');
  if (esCargo) {
    return texto.includes('COMISION') ? 'comision' : null;
  }
  return PALABRAS_DE_PARCIALIDAD.some((p) => texto.includes(p))
    ? 'parcialidad'
    : null;
}

const PALABRAS_DE_PARCIALIDAD = [
  'PARCIALIDAD',
  'PAGO PARCIAL',
  'ABONO PARCIAL',
];
