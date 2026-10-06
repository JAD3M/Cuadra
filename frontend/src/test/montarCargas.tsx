import type { QueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  CONFIG_POLLING_POR_DEFECTO,
  ContextoPolling,
  type ConfigPolling,
} from '@/features/cargas/ContextoPolling';
import type { SessionState } from '@/shared/sesion';
import { SESION_LISTA } from '@/test/fixtures';
import { envoltura } from '@/test/montarBandeja';

/** Constantes diminutas: el polling real corre en milisegundos, sin reloj falso. */
export const POLLING_RAPIDO: ConfigPolling = { intervaloMs: 15, topeMs: 150 };

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
  intervaloMs: number = POLLING_RAPIDO.intervaloMs,
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

/** Lo que `refetchInterval` devolvería ahora para la consulta de la clave. */
export function intervaloDe(
  cliente: QueryClient,
  clave: readonly unknown[],
): number | false | undefined {
  const consulta = cliente.getQueryCache().find({ queryKey: clave });
  const intervalo = consulta?.observers[0]?.options.refetchInterval;
  if (!consulta || intervalo === undefined) return undefined;
  return typeof intervalo === 'function' ? intervalo(consulta) : intervalo;
}

/**
 * Envoltura de `renderHook` para los hooks de cargas: consultas, sesión
 * inyectada y las constantes de polling dadas (las normativas por defecto).
 */
export function envolturaCargas(
  cliente: QueryClient,
  estado: () => SessionState = () => SESION_LISTA,
  polling: ConfigPolling = CONFIG_POLLING_POR_DEFECTO,
) {
  const Base = envoltura(cliente, estado);
  return function EnvolturaCargas({ children }: { children: ReactNode }) {
    return (
      <Base>
        <ContextoPolling.Provider value={polling}>
          {children}
        </ContextoPolling.Provider>
      </Base>
    );
  };
}
