import { describe, expect, it } from 'vitest';
import {
  ESTADOS_BANDEJA,
  ESTADOS_POR_DEFECTO,
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
} from './bandeja';
import * as dominio from './index';

describe('espejo de la bandeja', () => {
  it('conserva los valores y el orden del backend', () => {
    expect(ESTADOS_BANDEJA).toEqual(['conciliado', 'sugerencia', 'sin_match']);
    expect(ESTADOS_POR_DEFECTO).toEqual(['sugerencia', 'sin_match']);
    expect(LIMITE_POR_DEFECTO).toBe(50);
    expect(LIMITE_MAXIMO).toBe(200);
  });

  it('el estado por defecto solo contiene estados conocidos', () => {
    for (const e of ESTADOS_POR_DEFECTO) expect(ESTADOS_BANDEJA).toContain(e);
  });

  it('se reexporta desde el índice del dominio', () => {
    expect(dominio.ESTADOS_BANDEJA).toBe(ESTADOS_BANDEJA);
    expect(dominio.LIMITE_MAXIMO).toBe(200);
    expect(dominio.ETIQUETAS_ESTADO_BANDEJA.sin_match).toBe('Sin match');
  });
});
