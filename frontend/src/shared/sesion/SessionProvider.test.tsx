import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/shared/api';
import { esperarSinRastroDeSesion } from '@/test/invariantesSesion';
import {
  CREDENCIALES,
  EMPRESA_A,
  EMPRESA_B,
  espiar,
  montarSesion,
} from '@/test/montarSesion';
import { CONTEXTO_SESION } from '@/test/fixtures';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { servidor } from '@/test/servidor';
import { useSessionActions } from './useSessionActions';

describe('SessionProvider', () => {
  it('arranca anónimo y publica estado y acciones', () => {
    const { entorno } = montarSesion();
    expect(screen.getByTestId('estado')).toHaveTextContent('anonymous');
    expect(typeof entorno.acciones().iniciarSesion).toBe('function');
    esperarSinRastroDeSesion();
  });

  it('login correcto: pasa a selecting con usuario y empresas, sin token', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    const estado = entorno.estado();
    expect(estado.status).toBe('selecting');
    if (estado.status !== 'selecting') return;
    expect(estado.origen).toBe('login');
    expect(estado.usuario?.nombre).toBe('Jorge Tapia');
    expect(estado.empresas).toHaveLength(2);

    const publico = JSON.stringify(estado);
    expect(publico).not.toContain('secreta-1');
    expect(publico.toLowerCase()).not.toContain('token');
    expect(
      JSON.stringify(entorno.tienda.obtener()).toLowerCase(),
    ).not.toContain('token');
    esperarSinRastroDeSesion();
  });

  it('el login manda la cookie y se envía sin Authorization', async () => {
    const cabeceras: { autorizacion: string | null; credenciales: string }[] =
      [];
    servidor.use(
      http.post('/api/auth/login', ({ request }) => {
        cabeceras.push({
          autorizacion: request.headers.get('Authorization'),
          credenciales: request.credentials,
        });
        return HttpResponse.json({
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
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    expect(cabeceras).toEqual([
      { autorizacion: null, credenciales: 'include' },
    ]);
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
      esperarSinRastroDeSesion();
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

  it('elegirEmpresa: manda la cookie, pasa a ready con el contexto devuelto', async () => {
    const llamadas: { autorizacion: string | null; credenciales: string }[] =
      [];
    servidor.use(
      http.post('/api/auth/empresa/:id', ({ request, params }) => {
        llamadas.push({
          autorizacion: request.headers.get('Authorization'),
          credenciales: request.credentials,
        });
        expect(params['id']).toBe(EMPRESA_A);
        return HttpResponse.json(CONTEXTO_SESION);
      }),
    );
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(llamadas).toEqual([{ autorizacion: null, credenciales: 'include' }]);
    const estado = entorno.estado();
    expect(estado.status).toBe('ready');
    if (estado.status !== 'ready') return;
    expect(estado.contexto).toEqual(CONTEXTO_SESION);
    expect(JSON.stringify(estado).toLowerCase()).not.toContain('token');
    esperarSinRastroDeSesion();
  });

  it('elegirEmpresa sin selección activa no hace nada', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    expect(entorno.estado().status).toBe('anonymous');
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
    esperarSinRastroDeSesion();
  });

  it('una respuesta que llega después de «Cambiar de cuenta» se descarta', async () => {
    let liberar: () => void = () => {};
    const pausa = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    servidor.use(
      http.post('/api/auth/empresa/:id', async () => {
        await pausa;
        return HttpResponse.json(CONTEXTO_SESION);
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
    // La respuesta tardía no deja datos de una sesión que ya no existe.
    expect(
      entorno.consultas
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.data !== undefined),
    ).toEqual([]);
    esperarSinRastroDeSesion();
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
    it('cancela la sesión en el servidor y vuelve a anónimo', async () => {
      const espia = espiarSolicitudes();
      const { entorno } = montarSesion();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      act(() => entorno.acciones().volverAlInicio());
      expect(entorno.estado()).toEqual({ status: 'anonymous' });
      await waitFor(() =>
        expect(espia.cuantas('POST', '/api/auth/logout')).toBe(1),
      );
      espia.detener();
      esperarSinRastroDeSesion();
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

  describe('lo que ve el cliente de la API (M4, AUT-8)', () => {
    it('nunca manda Authorization: ni antes ni después de elegir empresa', async () => {
      const llamadas = espiar('/api/prueba');
      const { entorno } = montarSesion();
      await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
      await api.fetch('/prueba');
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
      await api.fetch('/prueba');
      expect(llamadas).toEqual([
        { autorizacion: null, credenciales: 'include' },
        { autorizacion: null, credenciales: 'include' },
      ]);
    });
  });

  describe('registro en el cliente', () => {
    function responder401() {
      servidor.use(
        http.get('/api/prueba', () =>
          HttpResponse.json(
            { statusCode: 401, error: 'x', message: 'y' },
            { status: 401 },
          ),
        ),
      );
    }

    async function conSesion(opciones: { estricto?: boolean } = {}) {
      const montada = montarSesion(opciones);
      await act(() => montada.entorno.acciones().iniciarSesion(CREDENCIALES));
      await act(() => montada.entorno.acciones().elegirEmpresa(EMPRESA_A));
      await waitFor(() =>
        expect(montada.entorno.estado().status).toBe('ready'),
      );
      return montada;
    }

    it('un 401 de la API con sesión viva la termina con sesion_expirada', async () => {
      const { entorno } = await conSesion();
      responder401();
      await expect(api.fetch('/prueba')).rejects.toBeInstanceOf(ApiError);
      expect(entorno.estado()).toEqual({
        status: 'ended',
        motivo: 'sesion_expirada',
      });
      expect(
        entorno.consultas
          .getQueryCache()
          .getAll()
          .filter((q) => q.state.data !== undefined),
      ).toEqual([]);
    });

    it('al desmontar se desregistra el hook: un 401 ya no termina la sesión', async () => {
      const { entorno, unmount } = await conSesion();
      unmount();
      responder401();
      await expect(api.fetch('/prueba')).rejects.toBeInstanceOf(ApiError);
      expect(entorno.estado().status).toBe('ready');
    });

    it('funciona bajo StrictMode (doble montaje) y sigue registrado', async () => {
      const { entorno } = await conSesion({ estricto: true });
      responder401();
      await expect(api.fetch('/prueba')).rejects.toBeInstanceOf(ApiError);
      expect(entorno.estado().status).toBe('ended');
    });

    it('un 401 de una sesión anterior (época rotada) no termina la actual', async () => {
      const { entorno } = await conSesion();
      let liberar: () => void = () => {};
      const pausa = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      servidor.use(
        http.get('/api/prueba', async () => {
          await pausa;
          return HttpResponse.json(
            { statusCode: 401, error: 'x', message: 'y' },
            { status: 401 },
          );
        }),
      );
      const enVuelo = api.fetch('/prueba').catch((e: unknown) => e);
      await act(() => entorno.acciones().cambiarEmpresa());
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));
      await waitFor(() => expect(entorno.estado().status).toBe('ready'));
      liberar();
      expect(await enVuelo).toBeInstanceOf(ApiError);
      expect(entorno.estado().status).toBe('ready');
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

  it('cada proveedor tiene su propio estado (no hay estado compartido)', async () => {
    const uno = montarSesion();
    await act(() => uno.entorno.acciones().iniciarSesion(CREDENCIALES));
    uno.unmount();
    const otro = montarSesion();
    expect(otro.entorno.estado().status).toBe('anonymous');
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
    await act(() => entorno.acciones().cerrarSesion());
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
