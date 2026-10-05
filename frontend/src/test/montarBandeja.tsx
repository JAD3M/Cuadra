import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { crearQueryClient } from '@/shared/api';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import { SESION_LISTA } from '@/test/fixtures';

/** Cliente de consultas de pruebas: sin reintentos ni recarga por foco. */
export function clienteDePruebas(): QueryClient {
  const cliente = crearQueryClient();
  cliente.setDefaultOptions({
    queries: { retry: false, retryDelay: 0, refetchOnWindowFocus: false },
    mutations: { retry: false },
  });
  return cliente;
}

/** Sesión lista con la época dada, para probar hooks sin el proveedor real. */
export function sesionConEpoca(epoca: number): SessionState {
  if (SESION_LISTA.status !== 'ready') throw new Error('fixture inválida');
  return { ...SESION_LISTA, epoca };
}

/**
 * Envoltura para `renderHook`: consultas + estado de sesión inyectado. Como
 * `estado` se lee en cada render, `rerender` con otro valor simula un cambio
 * de época.
 */
export function envoltura(
  cliente: QueryClient,
  estado: () => SessionState = () => SESION_LISTA,
) {
  return function Envoltura({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={cliente}>
        <SessionStateProvider estado={estado()}>
          {children}
        </SessionStateProvider>
      </QueryClientProvider>
    );
  };
}
