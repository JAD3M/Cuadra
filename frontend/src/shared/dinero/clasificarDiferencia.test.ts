import { describe, expect, it } from 'vitest';
import { clasificarDiferencia } from './clasificarDiferencia';
import { formatearMonto } from './formatearMonto';

describe('clasificarDiferencia', () => {
  it.each([null, undefined, '', 'abc', '1e3', '0x1F', 'NaN', ' 1'])(
    'devuelve sin_dato para %s',
    (valor) => {
      expect(clasificarDiferencia(valor)).toBe('sin_dato');
    },
  );

  it.each(['0', '0.0000', '-0', '-0.0000', '0.00000000000'])(
    'devuelve cero para %s',
    (valor) => {
      expect(clasificarDiferencia(valor)).toBe('cero');
    },
  );

  it.each(['0.0040', '-0.0040', '0.0049', '0.0049999', '0.0001'])(
    'devuelve subcentavo para %s',
    (valor) => {
      expect(clasificarDiferencia(valor)).toBe('subcentavo');
    },
  );

  it.each(['0.0050', '-0.0050', '0.4000', '-12.5000', '1160.0000'])(
    'devuelve distinta para %s',
    (valor) => {
      expect(clasificarDiferencia(valor)).toBe('distinta');
    },
  );

  it('compara el valor exacto, sin pasar por flotante', () => {
    expect(clasificarDiferencia('0.0000000001')).toBe('subcentavo');
    expect(clasificarDiferencia('9007199254740993.1200')).toBe('distinta');
    expect(clasificarDiferencia('0.00499999999999999999999')).toBe(
      'subcentavo',
    );
    expect(clasificarDiferencia('0.00500000000000000000001')).toBe('distinta');
  });

  it('coincide con lo que se muestra: subcentavo es exactamente lo que formatea a $0.00', () => {
    for (const v of ['0.0040', '-0.0049', '0.0050', '-0.0050', '0.0100']) {
      const muestraCero = formatearMonto(v)?.texto === '$0.00';
      expect(clasificarDiferencia(v) === 'subcentavo').toBe(muestraCero);
    }
  });
});
