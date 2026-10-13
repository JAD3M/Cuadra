import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '@/shared/api';
import { CONTEXTO_SESION, RESPUESTA_LOGIN } from '@/test/fixtures';
import { esperarSinRastroDeSesion } from '@/test/invariantesSesion';
import {
  CREDENCIALES,
  EMPRESA_A,
  EMPRESA_B,
  montarSesion,
  type EntornoSesion,
} from '@/test/montarSesion';
import { sesionConEmpresa } from '@/test/sesionMock';
import { servidor } from '@/test/servidor';

function error(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'detalle del servidor' },
    { status },
  );
}

/** Responde `/auth/contexto` con `respuesta` y cuenta las llamadas. */
function contexto(respuesta: () => Response | Promise<Response | void>) {
  const cuenta = {
    llamadas: 0,
    cabeceras: [] as { autorizacion: string | null; credenciales: string }[],
  };
  servidor.use(
    http.get('/api/auth/contexto', ({ request }) => {
      cuenta.llamadas += 1;
      cuenta.cabeceras.push({
        autorizacion: request.headers.get('Authorization'),
        credenciales: request.credentials,
      });
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
    // Un acceso nuevo puede ir al destino pedido (la guarda decide con `from`).
    expect(estado.restaurarOrigen).toBe(true);
    // El POST de elegir empresa ya trae el contexto: no pasa por `loading`.
    expect(entorno.historial()).toEqual(['anonymous', 'selecting', 'ready']);
    esperarSinRastroDeSesion();
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

  it('el contexto de elegir empresa se aplica sin pedirlo otra vez', async () => {
    const cuenta = contexto(() => HttpResponse.json(CONTEXTO_SESION));
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    await act(async () => {});
    expect(cuenta.llamadas).toBe(0);
  });

  it('la recarga pide el contexto con la cookie y sin Authorization', async () => {
    sesionConEmpresa();
    const cuenta = contexto(() => HttpResponse.json(CONTEXTO_SESION));
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(cuenta.cabeceras).toEqual([
      { autorizacion: null, credenciales: 'include' },
    ]);
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
    expect(JSON.stringify(entorno.estado()).toLowerCase()).not.toContain(
      'token',
    );
    expect(
      JSON.stringify(entorno.tienda.obtener()).toLowerCase(),
    ).not.toContain('token');
    expect(window.history.state).toBeNull();
    expect(window.location.href).toBe(antes);
  });

  it('funciona bajo StrictMode', async () => {
    const { entorno } = montarSesion({ estricto: true });
    await entrarYEsperarListo(entorno);
    expect(entorno.estado().status).toBe('ready');
  });
});

describe('fallos al volver a pedir el contexto', () => {
  /** Sesión lista; luego `reintentarContexto` vuelve a pedirlo y falla. */
  async function listoYReintentar(
    entorno: EntornoSesion,
    fallo: () => Response | Promise<Response | void>,
  ) {
    await entrarYEsperarListo(entorno);
    const cuenta = contexto(fallo);
    act(() => entorno.acciones().reintentarContexto());
    return cuenta;
  }

  it('403: termina con sin_acceso, una sola petición y sin reintentos', async () => {
    const { entorno } = montarSesion();
    const cuenta = await listoYReintentar(entorno, () => error(403));
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    expect(entorno.estado()).toEqual({ status: 'ended', motivo: 'sin_acceso' });
    expect(cuenta.llamadas).toBe(1);
    esperarSinRastroDeSesion();
  });

  it('401: termina con sesion_expirada, sin correo', async () => {
    const { entorno } = montarSesion();
    const cuenta = await listoYReintentar(entorno, () => error(401));
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sesion_expirada',
    });
    expect(cuenta.llamadas).toBe(1);
    esperarSinRastroDeSesion();
  });

  it.each([
    ['500', () => error(500)],
    ['fallo de red', () => HttpResponse.error()],
    ['un cuerpo con otra forma', () => HttpResponse.json({ usuario: 1 })],
    ['404', () => error(404)],
  ])(
    '%s: la sesión sigue lista con el último contexto conocido',
    async (_nombre, fallo) => {
      const { entorno } = montarSesion();
      const cuenta = await listoYReintentar(entorno, fallo);
      await waitFor(() => expect(cuenta.llamadas).toBeGreaterThan(0));
      await act(async () => {});
      expect(entorno.estado()).toMatchObject({ status: 'ready' });
      expect(entorno.tienda.obtener().fase).toBe('sesion');
    },
  );
});

describe('fallos del contexto al recargar', () => {
  beforeEach(() => sesionConEmpresa());

  it('403: termina con sin_acceso, una sola petición', async () => {
    const cuenta = contexto(() => error(403));
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ended'));
    expect(entorno.estado()).toEqual({ status: 'ended', motivo: 'sin_acceso' });
    expect(cuenta.llamadas).toBe(1);
    esperarSinRastroDeSesion();
  });

  it('500: reintenta dos veces y deja anónimo para entrar de nuevo', async () => {
    const cuenta = contexto(() => error(500));
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('anonymous'));
    expect(cuenta.llamadas).toBe(3);
  });

  it('un 500 pasajero se recupera sin pasar por el login', async () => {
    let n = 0;
    const cuenta = contexto(() => {
      n += 1;
      return n === 1 ? error(500) : HttpResponse.json(CONTEXTO_SESION);
    });
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(cuenta.llamadas).toBe(2);
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

  it('un 401 tardío de una sesión anterior (época rotada) se ignora', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    servidor.use(
      http.get('/api/prueba', async () => {
        await delay(20);
        return error(401);
      }),
    );
    const pendiente = api.fetch('/prueba').catch(() => undefined);
    // La sesión rota (otro cambio de empresa) mientras la petición vuela.
    await act(() => entorno.acciones().cambiarEmpresa());
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));
    await act(() => pendiente);
    expect(entorno.estado().status).toBe('ready');
  });

  it('un 401 de una llamada del flujo de acceso no termina la sesión', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() =>
      api.fetch('/prueba', { terminaSesion: false }).catch(() => 0),
    );
    expect(entorno.estado().status).toBe('ready');
  });

  it('un 401 sin sesión viva no hace nada', async () => {
    const { entorno } = montarSesion();
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.estado().status).toBe('anonymous');
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
  it('cerrarSesion: pide el logout, termina con cierre_voluntario y deja el cliente limpio', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    const peticiones: string[] = [];
    servidor.events.on('request:start', ({ request }) => {
      peticiones.push(`${request.method} ${new URL(request.url).pathname}`);
    });
    try {
      await act(() => entorno.acciones().cerrarSesion());
      await act(() => delay(30));
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(peticiones).toEqual(['POST /api/auth/logout']);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'cierre_voluntario',
    });
    esperarSinRastroDeSesion();
  });

  it('cerrarSesion vacía la caché de consultas', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    await act(() => entorno.acciones().cerrarSesion());
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

  it('cerrarSesion fuera de una sesión viva no hace nada', async () => {
    const { entorno } = montarSesion();
    const antes = entorno.estado();
    await act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado()).toBe(antes);
  });

  it('cerrarSesion mientras el contexto se vuelve a pedir descarta la respuesta', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    contexto(() => delay('infinite'));
    act(() => entorno.acciones().reintentarContexto());
    await act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado().status).toBe('ended');
  });
});

describe('consumirFin', () => {
  it('pasa de ended a anonymous una sola vez', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno);
    await act(() => entorno.acciones().cerrarSesion());
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

  it('está disponible en cuanto se elige empresa, sin esperar al contexto', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    contexto(() => delay('infinite'));
    await entrar(entorno, EMPRESA_A);
    expect(entorno.tienda.obtener()).toMatchObject({
      fase: 'sesion',
      restaurarOrigen: true,
    });
    expect(entorno.estado()).toMatchObject({
      status: 'ready',
      restaurarOrigen: true,
    });
  });

  it('se consume: tras cerrar sesión no queda empresa previa que restaurar', async () => {
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await act(() => entorno.acciones().cerrarSesion());
    expect(entorno.tienda.obtener()).toMatchObject({
      fase: 'ended',
      empresaPrevia: null,
    });
  });

  it('nunca viaja en el historial ni en la ubicación', async () => {
    const antes = window.location.href;
    const { entorno } = montarSesion();
    await entrarYEsperarListo(entorno, EMPRESA_A);
    await expirar(entorno);
    await entrarYEsperarListo(entorno, EMPRESA_A);
    expect(window.history.state).toBeNull();
    expect(window.location.href).toBe(antes);
    expect(JSON.stringify(entorno.estado()).toLowerCase()).not.toContain(
      'token',
    );
  });
});
