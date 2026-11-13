/**
 * La tasa del servidor ("0.0400") como porcentaje con dos decimales ("4.00 %"),
 * sin pasar por flotante: se desplaza la coma sobre el texto. `null` si no es
 * una tasa de 0 a 1 con cuatro decimales.
 */
export function formatearTasa(tasa: string): string | null {
  const m = /^(0|1)\.(\d{4})$/.exec(tasa);
  if (m === null || (m[1] === '1' && m[2] !== '0000')) return null;
  const centesimas = String(Number(`${m[1]}${m[2]}`)).padStart(3, '0');
  return `${centesimas.slice(0, -2)}.${centesimas.slice(-2)} %`;
}
