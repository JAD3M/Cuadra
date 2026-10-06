import { describe, expect, it } from 'vitest';
import { PERFILES } from '@/test/fixturesCargas';
import { perfilVigente } from './perfil';

describe('perfilVigente', () => {
  it('sin perfiles no hay perfil: el POST no manda `perfil`', () => {
    expect(perfilVigente(undefined, null)).toBeNull();
    expect(perfilVigente([], 'cuadra')).toBeNull();
  });

  it('sin elección arranca en el del servidor, cuadra (M13)', () => {
    expect(perfilVigente(PERFILES, null)).toBe('cuadra');
  });

  it('respeta lo elegido si sigue en la lista', () => {
    expect(perfilVigente(PERFILES, 'banco-sur')).toBe('banco-sur');
  });

  it('una elección que ya no existe vuelve al de por omisión', () => {
    expect(perfilVigente(PERFILES, 'viejo')).toBe('cuadra');
  });

  it('si el de por omisión no está, usa el primero de la API', () => {
    const sinCuadra = PERFILES.filter((p) => p.id !== 'cuadra');
    expect(perfilVigente(sinCuadra, null)).toBe('banco-norte');
  });
});
