import Decimal from 'decimal.js';
import { parsearMonto } from './parsearMonto';

/**
 * ¿La diferencia cae dentro de la tolerancia de la empresa? `|dif| <= tol`
 * con aritmética decimal sobre las cadenas originales, sin redondear: el
 * límite exacto está dentro y un décimo de milésimo más, fuera. Una
 * diferencia o una tolerancia ausente o inválida nunca está dentro.
 *
 * Es una ayuda de pantalla: el servidor sigue siendo quien decide el caso.
 */
export function dentroDeTolerancia(
  diferencia: string | null | undefined,
  tolerancia: string,
): boolean {
  if (typeof diferencia !== 'string') return false;
  const dif = parsearMonto(diferencia);
  const tol = parsearMonto(tolerancia);
  if (dif === null || tol === null) return false;
  return dif.abs().lte(tol);
}

/**
 * Porcentaje entero (de `'0'` a `'100'`) de la diferencia sobre la
 * tolerancia, para el ancho de la barra: `min(100, round_half_up(|dif| / tol
 * * 100))`. Devuelve los dígitos como cadena porque el código de dinero no
 * convierte a `number`; se usa como `${valor}%`. Con tolerancia cero es `'0'`
 * sin diferencia y `'100'` con ella. Un valor ausente o inválido es `'0'`.
 */
export function proporcionTolerancia(
  diferencia: string | null | undefined,
  tolerancia: string,
): string {
  if (typeof diferencia !== 'string') return '0';
  const dif = parsearMonto(diferencia);
  const tol = parsearMonto(tolerancia);
  if (dif === null || tol === null) return '0';
  const absoluta = dif.abs();
  if (tol.isZero()) return absoluta.isZero() ? '0' : '100';
  const porcentaje = absoluta.div(tol).times(100);
  return Decimal.min(porcentaje, 100).toFixed(0, Decimal.ROUND_HALF_UP);
}
