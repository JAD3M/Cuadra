import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router';
import { PlataformaLoginPage } from '@/features/plataforma/PlataformaLoginPage';
import { PlataformaPage } from '@/features/plataforma/PlataformaPage';
import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import { SesionPlataformaProvider } from '@/shared/sesion/plataforma';
import { EmpresaPage } from '@/features/auth/EmpresaPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { BandejaPage } from '@/features/bandeja/BandejaPage';
import { SUBTITULO, TITULO } from '@/features/bandeja/textos';
import { BitacoraPage } from '@/features/bitacora/BitacoraPage';
import {
  SUBTITULO_PAGINA as SUBTITULO_BITACORA,
  TITULO_PAGINA as TITULO_BITACORA,
} from '@/features/bitacora/textos';
import { CargasPage } from '@/features/cargas/CargasPage';
import { SUBTITULO_CARGAS } from '@/features/cargas/textos';
import { CasoPage } from '@/features/caso/CasoPage';
import { NoEncontradaPage } from '@/features/NoEncontradaPage';
import {
  subtituloPagina,
  TITULO_DOCUMENTO as TITULO_DOCUMENTO_TOLERANCIA,
  TITULO_PAGINA as TITULO_TOLERANCIA,
} from '@/features/tolerancia/textos';
import { TolerPage } from '@/features/tolerancia/TolerPage';
import { ShellLayout } from './shell/ShellLayout';
import type { ManejadorRuta } from './manejadorRuta';
import { RutaRaiz } from './RutaRaiz';
import { RutaAnonima, RutaProtegida, RutaSeleccion } from './rutas';
import { RutaAnonimaPlataforma } from './rutas/RutaAnonimaPlataforma';
import { RutaPlataforma } from './rutas/RutaPlataforma';

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
 * Tabla de rutas. Tres guardas, todas layouts sin ruta propia, deciden por la
 * sesión: `RutaAnonima` (`/login`), `RutaSeleccion` (`/empresa`) y
 * `RutaProtegida`, que envuelve a `ShellLayout` y a las cinco pantallas.
 * La galería de desarrollo y la vista de no encontrada no tienen guarda.
 */
export const rutas: RouteObject[] = [
  {
    element: <RutaRaiz />,
    children: [
      { path: '/', element: <Navigate to="/bandeja" replace /> },
      {
        element: <RutaAnonima />,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
            handle: titulo('Iniciar sesión'),
          },
        ],
      },
      {
        element: <RutaSeleccion />,
        children: [
          {
            path: '/empresa',
            element: <EmpresaPage />,
            handle: titulo('Elegir empresa'),
          },
        ],
      },
      {
        element: <RutaProtegida />,
        children: [
          {
            element: <ShellLayout />,
            children: [
              {
                path: '/bandeja',
                element: <BandejaPage />,
                handle: {
                  titulo: TITULO,
                  subtitulo: SUBTITULO,
                } satisfies ManejadorRuta,
              },
              {
                path: '/casos/:movimientoId',
                element: <CasoPage />,
                handle: titulo('Detalle del caso'),
              },
              {
                path: '/cargas',
                element: <CargasPage />,
                handle: {
                  titulo: 'Cargas',
                  subtitulo: SUBTITULO_CARGAS,
                } satisfies ManejadorRuta,
              },
              {
                path: '/tolerancia',
                element: <TolerPage />,
                handle: {
                  titulo: TITULO_TOLERANCIA,
                  subtituloConEmpresa: subtituloPagina,
                  tituloDocumento: TITULO_DOCUMENTO_TOLERANCIA,
                } satisfies ManejadorRuta,
              },
              {
                path: '/bitacora',
                element: <BitacoraPage />,
                handle: {
                  titulo: TITULO_BITACORA,
                  subtitulo: SUBTITULO_BITACORA,
                } satisfies ManejadorRuta,
              },
            ],
          },
        ],
      },
      {
        // Mundo de plataforma: su sesión se monta solo bajo estas rutas y no
        // comparte estado ni endpoints con la de empresa.
        element: (
          <SesionPlataformaProvider>
            <Outlet />
          </SesionPlataformaProvider>
        ),
        children: [
          {
            element: <RutaAnonimaPlataforma />,
            children: [
              {
                path: '/plataforma/login',
                element: <PlataformaLoginPage />,
                handle: titulo(TEXTOS_PLATAFORMA.tituloAcceso),
              },
            ],
          },
          {
            element: <RutaPlataforma />,
            children: [
              {
                path: '/plataforma',
                element: <PlataformaPage />,
                handle: titulo(TEXTOS_PLATAFORMA.tituloEmpresas),
              },
            ],
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
