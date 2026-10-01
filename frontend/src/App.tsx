import type { ComponentProps } from 'react';
import { RouterProvider } from 'react-router/dom';
import { Providers } from '@/app/providers';

export interface AppProps {
  /** Router de la app: `crearRouter()` en `main`, uno en memoria en pruebas. */
  router: ComponentProps<typeof RouterProvider>['router'];
}

/** Raíz de la aplicación: proveedores globales y router. */
export function App({ router }: AppProps) {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
