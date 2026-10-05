import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { crearQueryClient } from '@/shared/api';
import { ThemeProvider } from '@/shared/tema';
import { PlaceholderSessionProvider } from '@/shared/sesion';

/**
 * Proveedores globales de la app, de afuera hacia adentro: datos (React
 * Query), tema y sesión. CU-21 reemplaza `PlaceholderSessionProvider` por el
 * proveedor real sin tocar nada más.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [clienteConsultas] = useState(crearQueryClient);
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ThemeProvider>
        <PlaceholderSessionProvider>{children}</PlaceholderSessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
