import { describe, expect, it } from 'vitest';
import { tasaDeDesacuerdo } from './medicion';

describe('tasaDeDesacuerdo (historia 9.1)', () => {
  const tasa = {
    propuestas: 240,
    tratadas: 200,
    desacuerdos: 8,
    tasa: '0.0400',
  };

  it('acepta la tasa del servidor y la deja como texto', () => {
    const r = tasaDeDesacuerdo.parse(tasa);
    expect(r).toEqual(tasa);
    expect(typeof r.tasa).toBe('string');
  });

  it('sin propuestas tratadas la tasa es null', () => {
    const r = tasaDeDesacuerdo.parse({
      propuestas: 3,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
    expect(r.tasa).toBeNull();
  });

  it('una tasa numérica, vacía o con coma falla', () => {
    for (const mala of [0.04, '', '0,04', '4%', 'abc']) {
      expect(() => tasaDeDesacuerdo.parse({ ...tasa, tasa: mala })).toThrow();
    }
  });

  it('los contadores deben ser enteros no negativos', () => {
    for (const campo of ['propuestas', 'tratadas', 'desacuerdos']) {
      for (const malo of [-1, 1.5, '3']) {
        expect(() =>
          tasaDeDesacuerdo.parse({ ...tasa, [campo]: malo }),
        ).toThrow();
      }
    }
  });

  it('exige todos los campos', () => {
    for (const campo of ['propuestas', 'tratadas', 'desacuerdos', 'tasa']) {
      expect(() =>
        tasaDeDesacuerdo.parse({ ...tasa, [campo]: undefined }),
      ).toThrow();
    }
  });
});
