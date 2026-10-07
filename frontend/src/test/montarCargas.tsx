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

// El testigo de reloj vive en `esperar.ts` (lo usan también las pruebas de
// otras pantallas); se reexporta aquí para no tocar las pruebas de cargas.
export { esperarIntervalos, INTERVALOS_TESTIGO } from '@/test/esperar';

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
