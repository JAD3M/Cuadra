import { describe, expect, it } from 'vitest';
import { INTERVALO_TESTIGO_MS, INTERVALOS_TESTIGO } from '@/test/esperar';
import { POLLING_RAPIDO } from '@/test/montarCargas';

// El testigo de reloj de `esperar.ts` mide el mismo periodo que el polling
// rápido de las pruebas de cargas. Si alguno cambia sin el otro, una ausencia
// "probada" dejaría de cubrir los intervalos del polling real.
describe('testigo de reloj de las pruebas', () => {
  it('su intervalo es el del polling rápido de cargas', () => {
    expect(POLLING_RAPIDO.intervaloMs).toBe(INTERVALO_TESTIGO_MS);
  });

  it('exige al menos 3 intervalos por defecto', () => {
    expect(INTERVALOS_TESTIGO).toBeGreaterThanOrEqual(3);
  });
});
