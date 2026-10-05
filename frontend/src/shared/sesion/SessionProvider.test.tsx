import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, crearQueryClient } from '@/shared/api';
import { servidor } from '@/test/servidor';
import { esperarTokensCoherentes } from '@/test/invariantesSesion';
import { crearAlmacenTokens, type AlmacenTokens } from './almacenTokens';
import {
  ESTADO_INICIAL,
  crearTienda,
  reducir,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from './maquina';
import { SessionProvider } from './SessionProvider';
import type { AccionesSesion, SessionState } from './tipos';
import { useSessionActions } from './useSessionActions';
import { useSessionContext } from './useSessionContext';

const CREDENCIALES = {
  email: 'jorge.tapia@despacho.mx',
  password: 'secreta-1',
};
const EMPRESA_A = '7a1c9e52-0b34-4d6f-8e21-5c9d3b7a4f10';

interface Entorno {
  almacen: AlmacenTokens;
  tienda: Tienda<EstadoInterno, EventoSesion>;
  consultas: QueryClient;
  estado: () => SessionState;
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

function montar(opciones: { estricto?: boolean } = {}) {
  const salida = {
    almacen: crearAlmacenTokens(),
    tienda: crearTienda(reducir, ESTADO_INICIAL),
    consultas: crearQueryClient(),
  } as Entorno;
  const arbol = (
    <QueryClientProvider client={salida.consultas}>
      <SessionProvider almacen={salida.almacen} tienda={salida.tienda}>
        <Sonda
          alLeer={(estado, acciones) => {
            salida.estado = () => estado;
            salida.acciones = () => acciones;
          }}
        />
      </SessionProvider>
    </QueryClientProvider>
  );
  const vista = render(
    opciones.estricto ? <StrictMode>{arbol}</StrictMode> : arbol,
  );
  return { ...salida, ...vista, entorno: salida };
}

/** Registra método, ruta y cabecera Authorization de cada llamada. */
function espiar(ruta: string) {
  const llamadas: (string | null)[] = [];
  servidor.use(
    http.get(ruta, ({ request }) => {
      llamadas.push(request.headers.get('Authorization'));
      return HttpResponse.json({ ok: true });
    }),
  );
  return llamadas;
}

describe('SessionProvider', () => {
  it('arranca anónimo y publica estado y acciones', () => {
    const { entorno } = montar();
    expect(screen.getByTestId('estado')).toHaveTextContent('anonymous');
    expect(typeof entorno.acciones().iniciarSesion).toBe('function');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('login correcto: pasa a selecting con usuario y empresas, sin token', async () => {
    const { entorno } = montar();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    const estado = entorno.estado();
    expect(estado.status).toBe('selecting');
    if (estado.status !== 'selecting') return;
    expect(estado.origen).toBe('login');
    expect(estado.usuario.nombre).toBe('Jorge Tapia');
    expect(estado.empresas).toHaveLength(2);

    const publico = JSON.stringify(estado);
    expect(publico).not.toContain('token-de-seleccion');
    expect(publico).not.toContain('secreta-1');
    expect(JSON.stringify(entorno.tienda.obtener())).not.toContain(
      'token-de-seleccion',
    );
    expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
    expect(entorno.almacen.email()).toBe(CREDENCIALES.email);
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('el login se envía sin Authorization', async () => {
    const cabeceras: (string | null)[] = [];
    servidor.use(
      http.post('/api/auth/login', ({ request }) => {
        cabeceras.push(request.headers.get('Authorization'));
        return HttpResponse.json({
          token: 't',
          usuario: {
            id: '3f2b8a6e-6c1d-4a39-9d5e-0c1f7a1b2c3d',
            nombre: 'N',
            email: 'a@b.mx',
          },
          empresas: [],
        });
      }),
    );
    const { entorno } = montar();
    entorno.almacen.fijarSesion('token-colgado');
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    expect(cabeceras).toEqual([null]);
  });

  it.each([400, 401, 403, 500])(
    'un login con %i rechaza con ApiError y sigue anónimo',
    async (status) => {
      servidor.use(
        http.post('/api/auth/login', () =>
          HttpResponse.json(
            { statusCode: status, error: 'x', message: 'y' },
            { status },
          ),
        ),
      );
      const { entorno } = montar();
      await expect(
        act(() => entorno.acciones().iniciarSesion(CREDENCIALES)),
      ).rejects.toBeInstanceOf(ApiError);
      expect(entorno.estado().status).toBe('anonymous');
      expect(entorno.almacen.seleccion()).toBeNull();
      esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
    },
  );

  it('un fallo de red en el login rechaza y sigue anónimo', async () => {
    servidor.use(http.post('/api/auth/login', () => HttpResponse.error()));
    const { entorno } = montar();
    await expect(
      act(() => entorno.acciones().iniciarSesion(CREDENCIALES)),
    ).rejects.toThrow();
    expect(entorno.estado().status).toBe('anonymous');
  });

  it('iniciarSesion fuera de anónimo no hace ninguna petición', async () => {
    const { entorno } = montar();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    // Si hiciera una petición, MSW (onUnhandledRequest: error) no lo impide
    // porque el login tiene manejador; se cuenta con uno propio.
    let llamadas = 0;
    servidor.use(
      http.post('/api/auth/login', () => {
        llamadas += 1;
        return HttpResponse.json({});
      }),
    );
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    expect(llamadas).toBe(0);
    expect(entorno.estado().status).toBe('selecting');
  });

  it('elegirEmpresa: canjea con el token de selección y pasa a loading', async () => {
    const cabeceras: (string | null)[] = [];
    servidor.use(
      http.post('/api/auth/empresa/:id', ({ request, params }) => {
        cabeceras.push(request.headers.get('Authorization'));
        expect(params['id']).toBe(EMPRESA_A);
        return HttpResponse.json({ token: 'token-de-sesion' });
      }),
    );
    const { entorno } = montar();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(cabeceras).toEqual(['Bearer token-de-seleccion']);
    expect(entorno.estado()).toEqual({
      status: 'loading',
      restaurarOrigen: false,
    });
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    expect(JSON.stringify(entorno.estado())).not.toContain('token-de-');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('elegirEmpresa sin selección activa no hace nada', async () => {
    const { entorno } = montar();
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(entorno.estado().status).toBe('anonymous');
    expect(entorno.almacen.sesion()).toBeNull();
  });

  it('un fallo al elegir deja el paso de selección intacto', async () => {
    servidor.use(
      http.post('/api/auth/empresa/:id', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'x', message: 'y' },
          { status: 500 },
        ),
      ),
    );
    const { entorno } = montar();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_A)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado().status).toBe('selecting');
    expect(entorno.almacen.sesion()).toBeNull();
    expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
  });

  it('una respuesta que llega después de «Cambiar de cuenta» se descarta', async () => {
    let liberar: () => void = () => {};
    const pausa = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    servidor.use(
      http.post('/api/auth/empresa/:id', async () => {
        await pausa;
        return HttpResponse.json({ token: 'token-tardio' });
      }),
    );
    const { entorno } = montar();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    let pendiente: Promise<void> = Promise.resolve();
    act(() => {
      pendiente = entorno.acciones().elegirEmpresa(EMPRESA_A);
    });
    act(() => entorno.acciones().volverAlInicio());
    liberar();
    await act(() => pendiente);
    expect(entorno.estado().status).toBe('anonymous');
    expect(entorno.almacen.sesion()).toBeNull();
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('vacía la caché de consultas al elegir empresa', async () => {
    const { entorno } = montar();
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBe('privado');
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
  });

  describe('«Cambiar de cuenta»', () => {
    it('descarta el token de selección y el correo, y vuelve a anónimo', async () => {
      const { entorno } = montar();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.estado()).toEqual({ status: 'anonymous' });
      expect(entorno.almacen.seleccion()).toBeNull();
      expect(entorno.almacen.email()).toBeNull();
      esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
    });

    it('vacía la caché de consultas', async () => {
      const { entorno } = montar();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    });

    it('no hace nada si no se está en la selección de un login', () => {
      const { entorno } = montar();
      const antes = entorno.estado();
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.estado()).toBe(antes);
    });
  });

  describe('token que ve el cliente de la API (M4, AUT-8)', () => {
    it('antes de elegir empresa no hay Authorization, aunque exista el de selección', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montar();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await api.fetch('/prueba');
      expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
      expect(llamadas).toEqual([null]);
    });

    it('con sesión solo viaja el token de sesión, nunca el de selección', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montar();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
      await api.fetch('/prueba');
      expect(llamadas).toEqual(['Bearer token-de-sesion']);
      expect(llamadas.join()).not.toContain('token-de-seleccion');
    });
  });

  describe('registro en el cliente', () => {
    it('al desmontar se desregistra el proveedor de token', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno, unmount } = montar();
      entorno.almacen.fijarSesion('token-vivo');
      await api.fetch('/prueba');
      unmount();
      await api.fetch('/prueba');
      expect(llamadas).toEqual(['Bearer token-vivo', null]);
    });

    it('funciona bajo StrictMode (doble montaje) y sigue registrado', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montar({ estricto: true });
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
      await api.fetch('/prueba');
      expect(llamadas).toEqual(['Bearer token-de-sesion']);
      expect(entorno.estado().status).toBe('loading');
    });

    it('bajo StrictMode desmontar también desregistra', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno, unmount } = montar({ estricto: true });
      entorno.almacen.fijarSesion('token-vivo');
      unmount();
      await api.fetch('/prueba');
      expect(llamadas).toEqual([null]);
    });
  });

  it('las acciones tienen identidad estable entre renders', async () => {
    const { entorno } = montar();
    const antes = entorno.acciones();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await waitFor(() =>
      expect(screen.getByTestId('estado')).toHaveTextContent('selecting'),
    );
    expect(entorno.acciones()).toBe(antes);
  });

  it('cada proveedor tiene su propio almacén (no hay estado compartido)', async () => {
    const uno = montar();
    await act(() => uno.entorno.acciones().iniciarSesion(CREDENCIALES));
    uno.unmount();
    const otro = montar();
    expect(otro.entorno.estado().status).toBe('anonymous');
    expect(otro.entorno.almacen.seleccion()).toBeNull();
  });
});

describe('hooks de la sesión', () => {
  it('useSessionActions falla fuera de un proveedor con acciones', () => {
    function Lector() {
      useSessionActions();
      return null;
    }
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lector />)).toThrow(/proveedor de sesión/);
    consola.mockRestore();
  });
});
