import { describe, expect, it } from 'vitest';
import { INTERVALO_MS, TOPE_MS, VIGENCIA_PERFILES_MS } from './constantes';
import { CONFIG_POLLING_POR_DEFECTO } from './ContextoPolling';

describe('constantes normativas del polling', () => {
  it('3 s de intervalo y 5 minutos de tope', () => {
    expect(INTERVALO_MS).toBe(3000);
    expect(TOPE_MS).toBe(300_000);
  });

  it('los perfiles se consideran vigentes 5 minutos', () => {
    expect(VIGENCIA_PERFILES_MS).toBe(300_000);
  });

  it('el contexto arranca con las constantes normativas', () => {
    expect(CONFIG_POLLING_POR_DEFECTO).toEqual({
      intervaloMs: 3000,
      topeMs: 300_000,
    });
  });
});
