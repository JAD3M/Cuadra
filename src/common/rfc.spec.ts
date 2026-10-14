import { normalizarRfc, validarRfc } from './rfc';

describe('normalizarRfc', () => {
  it('recorta, quita todo espacio en blanco y pasa a mayúsculas', () => {
    expect(normalizarRfc('  fdb 190215\tqk4\n')).toBe('FDB190215QK4');
  });

  it('conserva Ñ y &', () => {
    expect(normalizarRfc('ñaa 010101 aa1')).toBe('ÑAA010101AA1');
    expect(normalizarRfc('a&b010101aa1')).toBe('A&B010101AA1');
  });
});

describe('validarRfc', () => {
  it.each(['FDB190215QK4', 'PEPJ800101AB3', 'ÑAA010101AA1', 'A&B010101AA1'])(
    'acepta %s',
    (rfc) => {
      expect(validarRfc(rfc)).toEqual({ valido: true });
    },
  );

  it.each(['XAXX010101000', 'XEXX010101000'])(
    'rechaza el genérico %s con motivo propio',
    (rfc) => {
      const r = validarRfc(rfc);
      expect(r).toMatchObject({ valido: false, motivo: 'generico' });
      expect(r.valido ? '' : r.mensaje).toMatch(/genérico/i);
    },
  );

  it.each([
    ['vacío', ''],
    ['muy corto', 'ABC'],
    ['mes 13', 'FDB191315QK4'],
    ['día 32', 'FDB190232QK4'],
    ['con minúsculas sin normalizar', 'fdb190215qk4'],
    ['con espacios', 'FDB 190215QK4'],
  ])('rechaza por formato: %s', (_nombre, rfc) => {
    const r = validarRfc(rfc);
    expect(r).toMatchObject({ valido: false, motivo: 'formato' });
    expect(r.valido ? '' : r.mensaje).toMatch(/formato/i);
  });
});
