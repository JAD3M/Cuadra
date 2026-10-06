import { createContext, useContext } from 'react';
import { INTERVALO_MS, TOPE_MS } from './constantes';

/**
 * Constantes del polling. Se inyectan por contexto para que las pruebas usen
 * valores diminutos sin temporizadores falsos ni estado global mutable.
 */
export interface ConfigPolling {
  intervaloMs: number;
  topeMs: number;
}

export const CONFIG_POLLING_POR_DEFECTO: ConfigPolling = {
  intervaloMs: INTERVALO_MS,
  topeMs: TOPE_MS,
};

export const ContextoPolling = createContext<ConfigPolling>(
  CONFIG_POLLING_POR_DEFECTO,
);

export function useConfigPolling(): ConfigPolling {
  return useContext(ContextoPolling);
}
