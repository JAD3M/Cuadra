import type { ReactNode } from 'react';
import { ESTADO_SESION_PLACEHOLDER } from './contextoPlaceholder';
import { SessionStateProvider } from './SessionStateProvider';

/**
 * PROVISIONAL (CU-20): sesión fija en `ready`, sin autenticación, sin tokens
 * y sin llamadas a la API. CU-21 reemplaza este proveedor por uno real en
 * `providers.tsx`; el hook `useSessionContext` no cambia.
 */
export function PlaceholderSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionStateProvider estado={ESTADO_SESION_PLACEHOLDER}>
      {children}
    </SessionStateProvider>
  );
}
