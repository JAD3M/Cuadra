import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { crearQueryClient } from '@/shared/api';
import { ThemeProvider } from '@/shared/tema';
import { SessionProvider } from '@/shared/sesion';

/**
 * Proveedores globales de la app, de afuera hacia adentro: datos (React
 * Query), tema y sesión. La sesión va dentro del cliente de consultas porque
 * lo usa (contexto) y lo vacía al cambiar de empresa y al terminar. La sesión
 * es una cookie `httpOnly`: al recargar, el proveedor la restaura preguntando
 * al servidor.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [clienteConsultas] = useState(crearQueryClient);
  // Las rutas de `/plataforma` tienen su propia sesión (cookie de otro tipo).
  // Restaurar la de empresa ahí llamaría a `/auth/contexto`, que responde 403
  // y deja un acceso denegado en `bitacora_plataforma` en cada carga. Se
  // decide una vez, al arrancar: entrar a `/plataforma` es una carga completa.
  const [enPlataforma] = useState(() =>
    window.location.pathname.startsWith('/plataforma'),
  );
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ThemeProvider>
        {enPlataforma ? (
          children
        ) : (
          <SessionProvider>{children}</SessionProvider>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
