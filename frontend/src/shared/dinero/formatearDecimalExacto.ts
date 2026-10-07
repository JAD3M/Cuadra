import { parsearMonto } from './parsearMonto';

export interface OpcionesDecimalExacto {
  /** Decimales mínimos a mostrar; los ceros sobrantes se recortan hasta ahí. */
  minimoDecimales?: number;
}

/**
 * Da formato a un decimal en cadena SIN redondear nunca: recorta los ceros
 * finales de la parte fraccionaria hasta `minimoDecimales` (2 por defecto) y
 * conserva todos los demás dígitos. Sirve donde el valor se vuelve a guardar
 * (la tolerancia): `0.0050` -> `0.005`, `0.5000` -> `0.50`, `12.3456` intacto.
 * Sin separador de miles, sin símbolo y sin configuración regional; quien lo
 * muestra agrega `$` o la moneda. Devuelve `null` si la cadena no es un
 * decimal válido, y un cero negativo sale sin signo.
 *
 * `toFixed()` sin precisión da la notación normal con todos los dígitos (nunca
 * exponente); no pasa por `Number`.
 */
export function formatearDecimalExacto(
  valor: string,
  { minimoDecimales = 2 }: OpcionesDecimalExacto = {},
): string | null {
  const decimal = parsearMonto(valor);
  if (decimal === null) return null;

  const fijo = decimal.isZero() ? '0' : decimal.toFixed();
  const [entero = '0', fraccion = ''] = fijo.split('.');
  const recortada = fraccion.replace(/0+$/, '');
  const completa = recortada.padEnd(minimoDecimales, '0');
  return completa === '' ? entero : `${entero}.${completa}`;
}
