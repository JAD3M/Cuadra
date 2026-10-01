import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { EmpresaPage } from '@/features/auth/EmpresaPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { BandejaPage } from '@/features/bandeja/BandejaPage';
import { BitacoraPage } from '@/features/bitacora/BitacoraPage';
import { CargasPage } from '@/features/cargas/CargasPage';
import { CasoPage } from '@/features/caso/CasoPage';
import { NoEncontradaPage } from '@/features/NoEncontradaPage';
import { TolerPage } from '@/features/tolerancia/TolerPage';
import { ShellLayout } from './shell/ShellLayout';
import type { ManejadorRuta } from './manejadorRuta';
import { RutaRaiz } from './RutaRaiz';

function titulo(titulo: string): ManejadorRuta {
  return { titulo };
}

/**
 * Galería de componentes. La condición `import.meta.env.DEV` está escrita
 * aquí, sin pasar por una variable, para que Vite la sustituya por `false` en
 * producción y elimine tanto la ruta como el chunk de la galería.
 */
const rutasDeDesarrollo: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/__kit',
        lazy: async () => ({
          Component: (await import('./RutaKit')).RutaKit,
        }),
        handle: titulo('Galería de componentes'),
      },
    ]
  : [];

/**
 * Tabla de rutas. `/login` y `/empresa` van fuera del shell; el resto vive
 * bajo `ShellLayout`, un layout sin ruta propia.
 */
export const rutas: RouteObject[] = [
  {
    element: <RutaRaiz />,
    children: [
      { path: '/', element: <Navigate to="/bandeja" replace /> },
      {
        path: '/login',
        element: <LoginPage />,
        handle: titulo('Iniciar sesión'),
      },
      {
        path: '/empresa',
        element: <EmpresaPage />,
        handle: titulo('Elegir empresa'),
      },
      {
        element: <ShellLayout />,
        children: [
          {
            path: '/bandeja',
            element: <BandejaPage />,
            handle: titulo('Bandeja'),
          },
          {
            path: '/casos/:id',
            element: <CasoPage />,
            handle: titulo('Detalle del caso'),
          },
          {
            path: '/cargas',
            element: <CargasPage />,
            handle: titulo('Cargas'),
          },
          {
            path: '/tolerancia',
            element: <TolerPage />,
            handle: titulo('Tolerancia'),
          },
          {
            path: '/bitacora',
            element: <BitacoraPage />,
            handle: titulo('Bitácora'),
          },
        ],
      },
      ...rutasDeDesarrollo,
      {
        path: '*',
        element: <NoEncontradaPage />,
        handle: titulo('Página no encontrada'),
      },
    ],
  },
];

/** Router del navegador para `main.tsx`. Las pruebas usan `createMemoryRouter(rutas)`. */
export function crearRouter() {
  return createBrowserRouter(rutas);
}
