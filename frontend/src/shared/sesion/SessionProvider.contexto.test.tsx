import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '@/shared/api';
import { CONTEXTO_SESION, RESPUESTA_LOGIN } from '@/test/fixtures';
import { esperarTokensCoherentes } from '@/test/invariantesSesion';
import {
  CREDENCIALES,
  EMPRESA_A,
  EMPRESA_B,
  montarSesion,
  type EntornoSesion,
} from '@/test/montarSesion';
import { servidor } from '@/test/servidor';

function error(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'detalle del servidor' },
    { status },
  );
}

/** Responde `/auth/contexto` con `respuesta` y cuenta las llamadas. */
function contexto(respuesta: () => Response | Promise<Response | void>) {
  const cuenta = { llamadas: 0, cabeceras: [] as (string | null)[] };
  servidor.use(
    http.get('/api/auth/contexto', ({ request }) => {
      cuenta.llamadas += 1;
      cuenta.cabeceras.push(request.headers.get('Authorization'));
      return respuesta();
    }),
  );
  return cuenta;
}

async function entrar(entorno: EntornoSesion, empresa = EMPRESA_A) {
  await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
  await act(() => entorno.acciones().elegirEmpresa(empresa));
}

async function entrarYEsperarListo(
  entorno: EntornoSesion,
  empresa = EMPRESA_A,
) {
  await entrar(entorno, empresa);
  await waitFor(() => expect(entorno.estado().status).toBe('ready'));
}

describe('contexto de la sesión', () => {
  it('con sesión viva consulta el contexto y publica ready', async () => {
    const { entorno } = montarSesion();
    await entrar(entorno);
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    const estado = entorno.estado();
    if (estado.status !== 'ready') throw new Error('debía estar ready');
    expect(estado.contexto).toEqual(CONTEXTO_SESION);
    expect(estado.restaurarOrigen).toBe(false);
    expect(entorno.historial()).toEqual([
      'anonymous',
      'selecting',
      'loading',
      'ready',
    ]);
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('puedeCambiarEmpresa es true con varias empresas', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    expect(entorno.estado()).toMatchObject({ puedeCambiarEmpresa: true });
  });

  it('puedeCambiarEmpresa es false con una sola empresa', async () => {
    const [primera] = RESPUESTA_LOGIN.empresas;
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ ...RESPUESTA_LOGIN, empresas: [primera] }),
      ),
    );
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    expect(entorno.estado()).toMatchObject({ puedeCambiarEmpresa: false });
  });

  it('el contexto se pide con el token de sesión, nunca con el de selección', async () => {
    const cuenta = contexto(() => HttpResponse.json(CONTEXTO_SESION));
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    expect(cuenta.cabeceras).toEqual(['Bearer token-de-sesion']);
  });

  it('la clave de la consulta lleva la época y ningún token', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    const claves = entorno.consultas
      .getQueryCache()
      .getAll()
      .map((consulta) => consulta.queryKey);
    expect(claves).toEqual([['sesion', 1, 'contexto']]);
    expect(JSON.stringify(claves)).not.toContain('token');
  });

  it('el estado, el historial y la ubicación no exponen tokens ni destino', async () => {
    const antes = window.location.href;
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    expect(JSON.stringify(entorno.estado())).not.toContain('token-de-');
    expect(JSON.stringify(entorno.tienda.obtener())).not.toContain('token-de-');
    expect(window.history.state).toBeNull();
    expect(window.location.href).toBe(antes);
  });

  it('funciona bajo StrictMode', async () => {
    const { entorno } = montarSesion({ estricto: true });
    await entrarYEsperarListo(entorno);
    expect(entorno.estado().status).toBe('ready');
  });
});

describe('fallos del contexto', () => {
  it('403: termina con sin_acceso, una sola petición y sin reintentos', async () => {
    const cuenta = contexto(() => error(403));
    const { entorno } = montarSesion();
    await entrar(entorno);
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    expect(entorno.estado()).toEqual({ status: 'ended', motivo: 'sin_acceso' });
    expect(cuenta.llamadas).toBe(1);
    expect(entorno.historial()).not.toContain('ready');
    expect(entorno.almacen.sesion()).toBeNull();
    expect(entorno.almacen.seleccion()).toBeNull();
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('401: termina con sesion_expirada, sin correo', async () => {
    const cuenta = contexto(() => error(401));
    const { entorno } = montarSesion();
    await entrar(entorno);
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sesion_expirada',
    });
    expect(cuenta.llamadas).toBe(1);
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it.each([
    ['500', () => error(500)],
    ['fallo de red', () => HttpResponse.error()],
  ])(
    '%s: unavailable tras dos reintentos y reintentarContexto lo recupera',
    async (_nombre, fallo) => {
      const cuenta = contexto(fallo);
      const { entorno } = montarSesion();
      await entrar(entorno);
      await waitFor(() => expect(entorno.estado().status).toBe('unavailable'));
      expect(cuenta.llamadas).toBe(3);
      // La sesión sigue viva: los tokens no se tocan.
      expect(entorno.almacen.sesion()).toBe('token-de-sesion');
      esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);

      contexto(() => HttpResponse.json(CONTEXTO_SESION));
      act(() => entorno.acciones().reintentarContexto());
      await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    },
  );

  it('un cuerpo con otra forma: unavailable sin reintentos', async () => {
    const cuenta = contexto(() => HttpResponse.json({ usuario: 1 }));
    const { entorno } = montarSesion();
    await entrar(entorno);
    await waitFor(() => expect(entorno.estado().status).toBe('unavailable'));
    expect(cuenta.llamadas).toBe(1);
  });

  it('un 404 no termina la sesión: unavailable', async () => {
    contexto(() => error(404));
    const { entorno } = montarSesion();
    await entrar(entorno);
    await waitFor(() => expect(entorno.estado().status).toBe('unavailable'));
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
  });
});

describe('401 en llamadas de la sesión', () => {
  it('varios 401 simultáneos terminan la sesión una sola vez', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    let terminaciones = 0;
    entorno.tienda.suscribir(() => {
      if (entorno.tienda.obtener().fase === 'ended') terminaciones += 1;
    });
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(async () => {
      await Promise.allSettled([
        api.fetch('/prueba'),
        api.fetch('/prueba'),
        api.fetch('/prueba'),
      ]);
    });
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sesion_expirada',
    });
    expect(terminaciones).toBe(1);
  });

  it('un 401 tardío tras rotar el token se ignora', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    servidor.use(
      http.get('/api/prueba', async () => {
        await delay(20);
        return error(401);
      }),
    );
    const pendiente = api.fetch('/prueba').catch(() => undefined);
    // La sesión rota (p. ej. otro cambio de empresa) mientras la petición vuela.
    entorno.almacen.fijarSesion('token-rotado');
    await act(() => pendiente);
    expect(entorno.estado().status).toBe('ready');
    expect(entorno.almacen.sesion()).toBe('token-rotado');
  });

  it('un 401 con token propio de la llamada no termina la sesión', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba', { token: 'otro' }).catch(() => 0));
    expect(entorno.estado().status).toBe('ready');
  });

  it('un 401 sin sesión viva no hace nada', async () => {
    const { entorno } = montarSesion();
    entorno.almacen.fijarSesion('token-suelto');
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.estado().status).toBe('anonymous');
    expect(entorno.almacen.sesion()).toBe('token-suelto');
  });

  it('un 403 fuera del contexto no termina la sesión', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    servidor.use(http.get('/api/prueba', () => error(403)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.estado().status).toBe('ready');
  });
});

describe('cierre de sesión', () => {
  it('cerrarSesion: ended cierre_voluntario, tokens fuera, sin peticiones', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    const peticiones: string[] = [];
    servidor.events.on('request:start', ({ request }) => {
      peticiones.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    try {
      act(() => entorno.acciones().cerrarSesion());
      await act(() => delay(30));
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(peticiones).toEqual([]);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'cierre_voluntario',
    });
    expect(entorno.almacen.sesion()).toBeNull();
    expect(entorno.almacen.seleccion()).toBeNull();
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('cerrarSesion vacía la caché de consultas', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    act(() => entorno.acciones().cerrarSesion());
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    // El observador del proveedor puede dejar una entrada vacía (sin datos).
    const conDatos = entorno.consultas
      .getQueryCache()
      .getAll()
      .filter((consulta) => consulta.state.data !== undefined);
    expect(conDatos).toHaveLength(0);
  });

  it('terminar por expiración también vacía la caché', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
  });

  it('cerrarSesion fuera de una sesión viva no hace nada', () => {
    const { entorno } = montarSesion();
    const antes = entorno.estado();
    act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado()).toBe(antes);
  });

  it('cerrarSesion mientras se carga el contexto descarta la respuesta', async () => {
    contexto(() => delay('infinite'));
    const { entorno } = montarSesion();
    await entrar(entorno);
    expect(entorno.estado().status).toBe('loading');
    act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado().status).toBe('ended');
  });
});

describe('consumirFin', () => {
  it('pasa de ended a anonymous una sola vez', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado().status).toBe('ended');
    act(() => entorno.acciones().consumirFin());
    expect(entorno.estado()).toEqual({ status: 'anonymous' });
    const antes = entorno.estado();
    act(() => entorno.acciones().consumirFin());
    expect(entorno.estado()).toBe(antes);
    expect(entorno.historial().filter((s) => s === 'anonymous')).toHaveLength(
      2,
    );
  });

  it('no hace nada fuera de ended', () => {
    const { entorno } = montarSesion();
    const antes = entorno.estado();
    act(() => entorno.acciones().consumirFin());
    expect(entorno.estado()).toBe(antes);
  });
});

describe('restaurarOrigen tras una expiración (SA-2)', () => {
  async function expirar(entorno: EntornoSesion) {
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.estado()).toMatchObject({
      status: 'ended',
      motivo: 'sesion_expirada',
    });
  }

  it('la misma empresa permite volver al origen', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrar(entorno, EMPRESA_A);
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(entorno.estado()).toMatchObject({ restaurarOrigen: true });
  });

  it('también cuando la pantalla de acceso ya consumió el fin', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    act(() => entorno.acciones().consumirFin());
    await entrar(entorno, EMPRESA_A);
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(entorno.estado()).toMatchObject({ restaurarOrigen: true });
  });

  it('otra empresa no lo permite', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrar(entorno, EMPRESA_B);
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(entorno.estado()).toMatchObject({ restaurarOrigen: false });
  });

  it('aparece también durante loading', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    contexto(() => delay('infinite'));
    await entrar(entorno, EMPRESA_A);
    expect(entorno.estado()).toEqual({
      status: 'loading',
      restaurarOrigen: true,
    });
  });

  it('se consume: una segunda sesión normal no hereda el destino', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrarYEsperarListo(entorno, EMPRESA_A);
    act(() => entorno.acciones().cerrarSesion());
    await entrarYEsperarListo(entorno, EMPRESA_A);
    expect(entorno.estado()).toMatchObject({ restaurarOrigen: false });
  });

  it('nunca viaja en el historial ni en la ubicación', async () => {
    const antes = window.location.href;
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrarYEsperarListo(entorno, EMPRESA_A);
    expect(window.history.state).toBeNull();
    expect(window.location.href).toBe(antes);
    expect(JSON.stringify(entorno.estado())).not.toContain('token');
  });
});
