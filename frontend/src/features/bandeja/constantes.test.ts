import { describe, expect, it } from 'vitest';
import { ESTADOS_BANDEJA } from '@/shared/dominio/bandeja';
import { ORDEN_ESTADOS } from './constantes';

describe('ORDEN_ESTADOS', () => {
  it('sigue el orden del mockup: sugerencia, sin match, conciliado', () => {
    expect(ORDEN_ESTADOS).toEqual(['sugerencia', 'sin_match', 'conciliado']);
  });

  it('es una permutación del espejo: ni sobra ni falta ningún estado', () => {
    expect([...ORDEN_ESTADOS].sort()).toEqual([...ESTADOS_BANDEJA].sort());
  });
});
