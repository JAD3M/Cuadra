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
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
