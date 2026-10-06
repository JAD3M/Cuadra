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

/** Espera real y acotada, solo para afirmar que algo NO vuelve a ocurrir. */
export const esperar = (ms: number) =>
  new Promise<void>((resolver) => setTimeout(resolver, ms));

/** Constantes diminutas: el polling real corre en milisegundos, sin reloj falso. */
export const POLLING_RAPIDO: ConfigPolling = { intervaloMs: 15, topeMs: 150 };

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
