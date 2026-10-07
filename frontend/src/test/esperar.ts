/**
 * Periodo del testigo de reloj, en ms. Es el del polling rápido de las pruebas
 * de cargas (`POLLING_RAPIDO.intervaloMs`); `esperar.test.ts` los mantiene
 * iguales.
 */
export const INTERVALO_TESTIGO_MS = 15;

/** Intervalos que el testigo exige antes de dar por probada una ausencia. */
export const INTERVALOS_TESTIGO = 4;

/**
 * Testigo de reloj: espera a que un temporizador independiente, del mismo
 * periodo que el polling, marque `n` veces, y verifica que el tiempo real
 * transcurrido cubre esos `n` intervalos. Una ausencia ("no hubo más
 * peticiones") solo vale tras el testigo: demuestra que el temporizador del
 * polling tuvo, en este entorno y con esta carga, ocasión de dispararse `n`
 * veces. No es una espera en ms: el criterio de salida son los ticks.
 */
export function esperarIntervalos(
  n: number = INTERVALOS_TESTIGO,
  intervaloMs: number = INTERVALO_TESTIGO_MS,
): Promise<void> {
  if (n < 3) throw new Error('el testigo exige al menos 3 intervalos');
  const inicio = performance.now();
  return new Promise<void>((resolver, rechazar) => {
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      if (ticks < n) return;
      clearInterval(id);
      // Holgura de 1 ms por tick: los temporizadores pueden adelantarse.
      const minimo = n * intervaloMs - n;
      const real = performance.now() - inicio;
      if (real < minimo) {
        rechazar(new Error(`testigo corto: ${real}ms < ${minimo}ms`));
        return;
      }
      resolver();
    }, intervaloMs);
  });
}
