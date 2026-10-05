import { act, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/shared/api';
import { esperarTokensCoherentes } from '@/test/invariantesSesion';
import {
  CREDENCIALES,
  EMPRESA_A,
  EMPRESA_B,
  espiar,
  montarSesion,
} from '@/test/montarSesion';
import { servidor } from '@/test/servidor';
import { useSessionActions } from './useSessionActions';

describe('SessionProvider', () => {
  it('arranca anónimo y publica estado y acciones', () => {
    const { entorno } = montarSesion();
    expect(screen.getByTestId('estado')).toHaveTextContent('anonymous');
    expect(typeof entorno.acciones().iniciarSesion).toBe('function');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('login correcto: pasa a selecting con usuario y empresas, sin token', async () => {
    const { entorno } = montarSesion();
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
    const { entorno } = montarSesion();
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
      const { entorno } = montarSesion();
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
    const { entorno } = montarSesion();
    await expect(
      act(() => entorno.acciones().iniciarSesion(CREDENCIALES)),
    ).rejects.toThrow();
    expect(entorno.estado().status).toBe('anonymous');
  });

  it('iniciarSesion fuera de anónimo no hace ninguna petición', async () => {
    const { entorno } = montarSesion();
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
    // El contexto no responde: se observa el estado `loading` sin carreras.
    servidor.use(
      http.get('/api/auth/contexto', () => delay('infinite')),
      http.post('/api/auth/empresa/:id', ({ request, params }) => {
        cabeceras.push(request.headers.get('Authorization'));
        expect(params['id']).toBe(EMPRESA_A);
        return HttpResponse.json({ token: 'token-de-sesion' });
      }),
    );
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(cabeceras).toEqual(['Bearer token-de-seleccion']);
    expect(entorno.estado()).toEqual({
      status: 'loading',
      restaurarOrigen: true,
    });
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    expect(JSON.stringify(entorno.estado())).not.toContain('token-de-');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('elegirEmpresa sin selección activa no hace nada', async () => {
    const { entorno } = montarSesion();
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
    const { entorno } = montarSesion();
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
    const { entorno } = montarSesion();
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
    const { entorno } = montarSesion();
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBe('privado');
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
  });

  describe('«Cambiar de cuenta»', () => {
    it('descarta el token de selección y el correo, y vuelve a anónimo', async () => {
      const { entorno } = montarSesion();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.estado()).toEqual({ status: 'anonymous' });
      expect(entorno.almacen.seleccion()).toBeNull();
      expect(entorno.almacen.email()).toBeNull();
      esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
    });

    it('vacía la caché de consultas', async () => {
      const { entorno } = montarSesion();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    });

    it('no hace nada si no se está en la selección de un login', () => {
      const { entorno } = montarSesion();
      const antes = entorno.estado();
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.estado()).toBe(antes);
    });
  });

  describe('token que ve el cliente de la API (M4, AUT-8)', () => {
    it('antes de elegir empresa no hay Authorization, aunque exista el de selección', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montarSesion();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await api.fetch('/prueba');
      expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
      expect(llamadas).toEqual([null]);
    });

    it('con sesión solo viaja el token de sesión, nunca el de selección', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montarSesion();
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
      const { entorno, unmount } = montarSesion();
      entorno.almacen.fijarSesion('token-vivo');
      await api.fetch('/prueba');
      unmount();
      await api.fetch('/prueba');
      expect(llamadas).toEqual(['Bearer token-vivo', null]);
    });

    it('funciona bajo StrictMode (doble montaje) y sigue registrado', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montarSesion({ estricto: true });
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
      await api.fetch('/prueba');
      expect(llamadas).toEqual(['Bearer token-de-sesion']);
      expect(entorno.estado().status).toBe('loading');
    });

    it('bajo StrictMode desmontar también desregistra', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno, unmount } = montarSesion({ estricto: true });
      entorno.almacen.fijarSesion('token-vivo');
      unmount();
      await api.fetch('/prueba');
      expect(llamadas).toEqual([null]);
    });
  });

  it('las acciones tienen identidad estable entre renders', async () => {
    const { entorno } = montarSesion();
    const antes = entorno.acciones();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await waitFor(() =>
      expect(screen.getByTestId('estado')).toHaveTextContent('selecting'),
    );
    expect(entorno.acciones()).toBe(antes);
  });

  it('cada proveedor tiene su propio almacén (no hay estado compartido)', async () => {
    const uno = montarSesion();
    await act(() => uno.entorno.acciones().iniciarSesion(CREDENCIALES));
    uno.unmount();
    const otro = montarSesion();
    expect(otro.entorno.estado().status).toBe('anonymous');
    expect(otro.entorno.almacen.seleccion()).toBeNull();
  });
});

describe('época pública de la sesión (ready.epoca)', () => {
  async function listo(entorno: ReturnType<typeof montarSesion>['entorno']) {
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
  }

  function epocaPublica(
    entorno: ReturnType<typeof montarSesion>['entorno'],
  ): number {
    const estado = entorno.estado();
    if (estado.status !== 'ready') throw new Error('la sesión no está lista');
    return estado.epoca;
  }

  it('ready publica la época interna, un contador sin token', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    expect(epocaPublica(entorno)).toBe(entorno.tienda.obtener().epoca);
    expect(typeof epocaPublica(entorno)).toBe('number');
  });

  it('aumenta tras elegir otra empresa', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = epocaPublica(entorno);
    await act(() => entorno.acciones().cambiarEmpresa());
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));
    await waitFor(() => expect(epocaPublica(entorno)).toBeGreaterThan(antes));
    expect(epocaPublica(entorno)).toBe(antes + 1);
  });

  it('no cambia con regresarSinCambiar', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = epocaPublica(entorno);
    await act(() => entorno.acciones().cambiarEmpresa());
    act(() => entorno.acciones().regresarSinCambiar());
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(epocaPublica(entorno)).toBe(antes);
  });

  it('es distinta tras cerrar sesión y volver a entrar', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = epocaPublica(entorno);
    act(() => entorno.acciones().cerrarSesion());
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    act(() => entorno.acciones().consumirFin());
    await listo(entorno);
    expect(epocaPublica(entorno)).not.toBe(antes);
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
