// src/conciliacion/referencia-fixtures.ts

/**
 * Casos [entrada, salida esperada] de la normalización de referencias (RN-1).
 * Los comparten la prueba unitaria y la de paridad contra Postgres: la salida
 * `null` de TypeScript es el NULL de `normalizar_referencia`.
 */
export const FIXTURES_REFERENCIA: ReadonlyArray<
  readonly [string | null, string | null]
> = [
  ['A-0001001', 'A1001'],
  ['0001001', '1001'],
  ['a 1001', 'A1001'],
  ['  fac-0012/7 ', 'FAC127'],
  ['000', '0'],
  ['A0', 'A0'],
  ['0A12', '0A12'],
  ['F-12B0034', 'F12B0034'],
  ['SPEI ñ 0005', 'SPEI5'],
  ['abc0012', 'ABC12'],
  ['Straße 007', 'STRAE7'],
  ['🎉 0123 🎉', '123'],
  ['１２３', null],
  ['\t\n0042\r\n', '42'],
  ['A' + '0'.repeat(127), 'A0'],
  [null, null],
  ['', null],
  ['   ', null],
  ['-/.,;', null],
];
