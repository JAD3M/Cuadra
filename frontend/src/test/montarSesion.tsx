import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode, useEffect } from 'react';
import { crearQueryClient, reintentarConsulta } from '@/shared/api';
import {
  crearAlmacenTokens,
  type AlmacenTokens,
} from '@/shared/sesion/almacenTokens';
import {
  ESTADO_INICIAL,
  crearTienda,
  reducir,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from '@/shared/sesion/maquina';
import { SessionProvider } from '@/shared/sesion/SessionProvider';
import type { AccionesSesion, SessionState } from '@/shared/sesion/tipos';
import { useSessionActions } from '@/shared/sesion/useSessionActions';
import { useSessionContext } from '@/shared/sesion/useSessionContext';
import { servidor } from '@/test/servidor';

export const CREDENCIALES = {
  email: 'jorge.tapia@despacho.mx',
  password: 'secreta-1',
};
export const EMPRESA_A = '7a1c9e52-0b34-4d6f-8e21-5c9d3b7a4f10';
export const EMPRESA_B = 'b2d4f6a8-1c3e-4f50-9a7b-2d4f6a8c0e1b';

export interface EntornoSesion {
  almacen: AlmacenTokens;
  tienda: Tienda<EstadoInterno, EventoSesion>;
  consultas: QueryClient;
  /** Último estado público que vio un consumidor. */
  estado: () => SessionState;
  /** Todos los estados públicos que vio, en orden (sin repetir seguidos). */
  historial: () => SessionState['status'][];
  acciones: () => AccionesSesion;
}

function Sonda({
  alLeer,
}: {
  alLeer: (estado: SessionState, acciones: AccionesSesion) => void;
}) {
  const estado = useSessionContext();
  const acciones = useSessionActions();
  useEffect(() => {
    alLeer(estado, acciones);
  });
  return <p data-testid="estado">{estado.status}</p>;
}

/**
 * Monta el `SessionProvider` real con un cliente de consultas de pruebas (sin
 * espera entre reintentos) y devuelve lo necesario para inspeccionarlo.
 */
export function montarSesion(opciones: { estricto?: boolean } = {}) {
  const consultas = crearQueryClient();
  consultas.setDefaultOptions({
    queries: {
      retry: reintentarConsulta,
      retryDelay: 0,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  });
  const vistos: SessionState['status'][] = [];
  const entorno = {
    almacen: crearAlmacenTokens(),
    tienda: crearTienda(reducir, ESTADO_INICIAL),
    consultas,
    historial: () => vistos,
  } as EntornoSesion;
  const arbol = (
    <QueryClientProvider client={consultas}>
      <SessionProvider almacen={entorno.almacen} tienda={entorno.tienda}>
        <Sonda
          alLeer={(estado, acciones) => {
            entorno.estado = () => estado;
            entorno.acciones = () => acciones;
            if (vistos.at(-1) !== estado.status) vistos.push(estado.status);
          }}
        />
      </SessionProvider>
    </QueryClientProvider>
  );
  const vista = render(
    opciones.estricto ? <StrictMode>{arbol}</StrictMode> : arbol,
  );
  return { ...vista, entorno };
}

/** Registra la cabecera Authorization de cada GET a `ruta`. */
export function espiar(ruta: string) {
  const llamadas: (string | null)[] = [];
  servidor.use(
    http.get(ruta, ({ request }) => {
      llamadas.push(request.headers.get('Authorization'));
      return HttpResponse.json({ ok: true });
    }),
  );
  return llamadas;
}
