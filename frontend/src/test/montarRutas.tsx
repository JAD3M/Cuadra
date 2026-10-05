import { act, render } from '@testing-library/react';
import { useState } from 'react';
import {
  createMemoryRouter,
  Outlet,
  parsePath,
  RouterProvider,
  useLocation,
} from 'react-router';
import {
  contextoSesion,
  listaEmpresasDisponibles,
} from '@/shared/api/contratos';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import { RutaAnonima, RutaProtegida, RutaSeleccion } from '@/app/rutas';
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
  },
  readyRestaurando: {
    status: 'ready',
    contexto: CONTEXTO,
    puedeCambiarEmpresa: true,
    restaurarOrigen: true,
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
