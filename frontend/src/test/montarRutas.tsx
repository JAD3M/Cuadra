import { QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import {
  createMemoryRouter,
  Outlet,
  parsePath,
  RouterProvider,
  useLocation,
  type InitialEntry,
} from 'react-router';
import { crearQueryClient } from '@/shared/api';
import {
  contextoSesion,
  listaEmpresasDisponibles,
} from '@/shared/api/contratos';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import {
  SesionPlataformaEstadoProvider,
  type EstadoPlataforma,
} from '@/shared/sesion/plataforma';
import { ThemeProvider } from '@/shared/tema';
import { rutas } from '@/app/router';
import { RutaAnonima, RutaProtegida, RutaSeleccion } from '@/app/rutas';
import { RutaAnonimaPlataforma } from '@/app/rutas/RutaAnonimaPlataforma';
import { RutaPlataforma } from '@/app/rutas/RutaPlataforma';
import { CONTEXTO_SESION, EMPRESAS_DISPONIBLES } from './fixtures';

const CONTEXTO = contextoSesion.parse(CONTEXTO_SESION);
const EMPRESAS = listaEmpresasDisponibles.parse(EMPRESAS_DISPONIBLES);

/** Estados de sesión con nombre, para las matrices de las guardas. */
export const ESTADOS = {
  anonymous: { status: 'anonymous' },
  selectingLogin: {
    status: 'selecting',
    origen: 'login',
    usuario: CONTEXTO.usuario,
    empresas: EMPRESAS,
  },
  selectingCambio: {
    status: 'selecting',
    origen: 'cambio',
    usuario: CONTEXTO.usuario,
    empresas: EMPRESAS,
  },
  loading: { status: 'loading', restaurarOrigen: false },
  loadingRestaurando: { status: 'loading', restaurarOrigen: true },
  unavailable: { status: 'unavailable' },
  ready: {
    status: 'ready',
    contexto: CONTEXTO,
    puedeCambiarEmpresa: true,
    restaurarOrigen: false,
    epoca: 1,
  },
  readyRestaurando: {
    status: 'ready',
    contexto: CONTEXTO,
    puedeCambiarEmpresa: true,
    restaurarOrigen: true,
    epoca: 1,
  },
} satisfies Record<string, SessionState>;

export function terminada(
  motivo: Extract<SessionState, { status: 'ended' }>['motivo'],
): SessionState {
  return { status: 'ended', motivo };
}

export interface Entrada {
  pathname: string;
  state?: unknown;
}

/**
 * Pantalla de prueba: anota su nombre en el espía cada vez que se dibuja y
 * muestra el estado del enrutador que recibió.
 */
function crearPantalla(espia: (nombre: string) => void) {
  return function Pantalla({ nombre }: { nombre: string }) {
    const { state, pathname, search, hash } = useLocation();
    espia(nombre);
    return (
      <>
        <p data-testid="pantalla">{nombre}</p>
        <output data-testid="ruta">{`${pathname}${search}${hash}`}</output>
        <output data-testid="state">{JSON.stringify(state)}</output>
      </>
    );
  };
}

/**
 * Árbol de rutas con la misma forma que el real (guardas como layouts sin
 * ruta) y pantallas de prueba. `cambiar` publica otro estado de sesión.
 */
export function montarRutas(entrada: string | Entrada, estado: SessionState) {
  const dibujadas: string[] = [];
  const Pantalla = crearPantalla((nombre) => dibujadas.push(nombre));
  const { pathname, state } =
    typeof entrada === 'string'
      ? { pathname: entrada, state: undefined }
      : entrada;
  const router = createMemoryRouter(
    [
      {
        element: <Outlet />,
        children: [
          {
            element: <RutaAnonima />,
            children: [
              { path: '/login', element: <Pantalla nombre="login" /> },
            ],
          },
          {
            element: <RutaSeleccion />,
            children: [
              { path: '/empresa', element: <Pantalla nombre="empresa" /> },
            ],
          },
          {
            element: <RutaProtegida />,
            children: [
              { path: '/bandeja', element: <Pantalla nombre="bandeja" /> },
              { path: '/casos/:id', element: <Pantalla nombre="caso" /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [{ ...parsePath(pathname), state }] },
  );

  let publicar: (nuevo: SessionState) => void = () => {};
  function Fuente() {
    const [actual, fijar] = useState(estado);
    publicar = fijar;
    return (
      <SessionStateProvider estado={actual}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    );
  }
  render(<Fuente />);

  return {
    router,
    dibujadas,
    cambiar: (nuevo: SessionState) => act(() => publicar(nuevo)),
  };
}

/** Estados de la sesión de plataforma con nombre, para la matriz de guardas. */
export const ESTADOS_PLATAFORMA = {
  restoring: { status: 'restoring' },
  anonymous: { status: 'anonymous' },
  ready: {
    status: 'ready',
    usuario: { id: 'dueno-1', correo: 'dueno@cuadra.mx' },
  },
  sesionTerminada: { status: 'ended', motivo: 'sesion_terminada' },
  sesionCerrada: { status: 'ended', motivo: 'sesion_cerrada' },
} satisfies Record<string, EstadoPlataforma>;

/**
 * Árbol de rutas de plataforma con la forma del real (guardas como layouts sin
 * ruta) y pantallas de prueba. `cambiar` publica otro estado de sesión.
 */
export function montarRutasPlataforma(
  entrada: string | Entrada,
  estado: EstadoPlataforma,
) {
  const dibujadas: string[] = [];
  const Pantalla = crearPantalla((nombre) => dibujadas.push(nombre));
  const { pathname, state } =
    typeof entrada === 'string'
      ? { pathname: entrada, state: undefined }
      : entrada;
  const router = createMemoryRouter(
    [
      {
        element: <Outlet />,
        children: [
          {
            element: <RutaAnonimaPlataforma />,
            children: [
              {
                path: '/plataforma/login',
                element: <Pantalla nombre="login-plataforma" />,
              },
            ],
          },
          {
            element: <RutaPlataforma />,
            children: [
              {
                path: '/plataforma',
                element: <Pantalla nombre="plataforma" />,
              },
            ],
          },
          { path: '/login', element: <Pantalla nombre="login" /> },
        ],
      },
    ],
    { initialEntries: [{ ...parsePath(pathname), state }] },
  );

  let publicar: (nuevo: EstadoPlataforma) => void = () => {};
  function Fuente() {
    const [actual, fijar] = useState(estado);
    publicar = fijar;
    return (
      <SesionPlataformaEstadoProvider estado={actual}>
        <RouterProvider router={router} />
      </SesionPlataformaEstadoProvider>
    );
  }
  render(<Fuente />);

  return {
    router,
    dibujadas,
    cambiar: (nuevo: EstadoPlataforma) => act(() => publicar(nuevo)),
  };
}

/**
 * La aplicación real de plataforma: la tabla de rutas verdadera dentro de los
 * proveedores de datos y tema, SIN el proveedor de sesión de empresa. Así una
 * prueba puede afirmar que ninguna ruta de plataforma pide algo de empresa.
 * Cada montaje es una página recién cargada.
 */
export function montarPlataforma(entrada: InitialEntry) {
  const router = createMemoryRouter(rutas, { initialEntries: [entrada] });
  const consultas = crearQueryClient();
  const vista = render(
    <QueryClientProvider client={consultas}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...vista, router, consultas };
}
