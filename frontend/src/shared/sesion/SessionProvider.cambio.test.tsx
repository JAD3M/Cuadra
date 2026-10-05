import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, api } from '@/shared/api';
import { EMPRESAS_DISPONIBLES } from '@/test/fixtures';
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

/** Cuenta las peticiones a una ruta (método y ruta exactos). */
function contar(metodo: string, ruta: string) {
  const cuenta = { n: 0, cabeceras: [] as (string | null)[] };
  servidor.events.on('request:start', ({ request }) => {
    if (
      request.method === metodo &&
      new URL(request.url).pathname === `/api${ruta}`
    ) {
      cuenta.n += 1;
      cuenta.cabeceras.push(request.headers.get('Authorization'));
    }
  });
  return cuenta;
}

async function listo(entorno: EntornoSesion) {
  await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
  await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
  await waitFor(() => expect(entorno.estado().status).toBe('ready'));
}

async function enCambio(entorno: EntornoSesion) {
  await listo(entorno);
  await act(() => entorno.acciones().cambiarEmpresa());
  expect(entorno.estado().status).toBe('selecting');
}

describe('cambiarEmpresa', () => {
  it('pide la lista con el token de selección y pasa a selecting(cambio)', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const llamadas = contar('GET', '/auth/empresas');
    try {
      await act(() => entorno.acciones().cambiarEmpresa());
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(llamadas.cabeceras).toEqual(['Bearer token-de-seleccion']);
    const estado = entorno.estado();
    expect(estado).toMatchObject({ status: 'selecting', origen: 'cambio' });
    if (estado.status !== 'selecting') return;
    expect(estado.empresas).toHaveLength(EMPRESAS_DISPONIBLES.length);
    expect(JSON.stringify(estado)).not.toContain('token-de-');
  });

  it('conserva ambos tokens (SA-1) y no cambia la época', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const epoca = entorno.tienda.obtener().epoca;
    await act(() => entorno.acciones().cambiarEmpresa());
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
    expect(entorno.tienda.obtener().epoca).toBe(epoca);
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('no vacía la caché al empezar el cambio', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    await act(() => entorno.acciones().cambiarEmpresa());
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBe('privado');
    expect(
      entorno.consultas.getQueryData(['sesion', 1, 'contexto']),
    ).toBeTruthy();
  });

  it('el proveedor sigue devolviendo el token de sesión durante el cambio', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    const cabeceras: (string | null)[] = [];
    servidor.use(
      http.get('/api/prueba', ({ request }) => {
        cabeceras.push(request.headers.get('Authorization'));
        return HttpResponse.json({});
      }),
    );
    await api.fetch('/prueba');
    expect(cabeceras).toEqual(['Bearer token-de-sesion']);
  });

  it('un 401 durante el cambio termina la sesión y vacía todo', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    servidor.use(http.get('/api/prueba', () => error(401)));
    await act(() => api.fetch('/prueba').catch(() => 0));
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sesion_expirada',
    });
    expect(entorno.almacen.sesion()).toBeNull();
    expect(entorno.almacen.seleccion()).toBeNull();
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('cerrar sesión durante el cambio descarta ambos tokens', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'cierre_voluntario',
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('401 en la lista: termina con reingreso y el correo para rellenar', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    servidor.use(http.get('/api/auth/empresas', () => error(401)));
    await expect(
      act(() => entorno.acciones().cambiarEmpresa()),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'reingreso',
      email: CREDENCIALES.email,
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it.each([
    ['fallo de red', () => HttpResponse.error()],
    ['500', () => error(500)],
    ['cuerpo con otra forma', () => HttpResponse.json({ no: 'es lista' })],
  ])('%s en la lista: sigue en ready y rechaza', async (_n, respuesta) => {
    const { entorno } = montarSesion();
    await listo(entorno);
    servidor.use(http.get('/api/auth/empresas', respuesta));
    await expect(
      act(() => entorno.acciones().cambiarEmpresa()),
    ).rejects.toBeInstanceOf(Error);
    expect(entorno.estado().status).toBe('ready');
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    expect(entorno.almacen.seleccion()).toBe('token-de-seleccion');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('una lista vacía termina con sin_empresas', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    servidor.use(http.get('/api/auth/empresas', () => HttpResponse.json([])));
    await act(() => entorno.acciones().cambiarEmpresa());
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sin_empresas',
      email: CREDENCIALES.email,
    });
  });

  it('sin token de selección pide reingresar', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    entorno.almacen.limpiarSeleccion();
    await act(() => entorno.acciones().cambiarEmpresa());
    expect(entorno.estado()).toEqual({ status: 'ended', motivo: 'reingreso' });
  });

  it('fuera de una sesión lista no hace nada', async () => {
    const { entorno } = montarSesion();
    const llamadas = contar('GET', '/auth/empresas');
    try {
      await act(() => entorno.acciones().cambiarEmpresa());
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(llamadas.n).toBe(0);
    expect(entorno.estado().status).toBe('anonymous');
  });

  it('si la sesión termina mientras se pide la lista, se descarta la respuesta', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    servidor.use(
      http.get('/api/auth/empresas', async () => {
        await delay(20);
        return HttpResponse.json(EMPRESAS_DISPONIBLES);
      }),
    );
    let pendiente: Promise<void> = Promise.resolve();
    act(() => {
      pendiente = entorno.acciones().cambiarEmpresa();
    });
    act(() => entorno.acciones().cerrarSesion());
    await act(() => pendiente);
    expect(entorno.estado().status).toBe('ended');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });
});

describe('regresarSinCambiar', () => {
  it('vuelve a la sesión viva sin pasar por loading ni pedir nada', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = entorno.estado();
    const contexto = contar('GET', '/auth/contexto');
    try {
      await act(() => entorno.acciones().cambiarEmpresa());
      act(() => entorno.acciones().regresarSinCambiar());
      await act(() => delay(20));
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(entorno.historial()).toEqual([
      'anonymous',
      'selecting',
      'loading',
      'ready',
      'selecting',
      'ready',
    ]);
    expect(entorno.estado()).toEqual(antes);
    expect(contexto.n).toBe(0);
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('no hace nada fuera del cambio de empresa', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = entorno.estado();
    act(() => entorno.acciones().regresarSinCambiar());
    expect(entorno.estado()).toBe(antes);
  });

  it('en el paso de un login no lo abandona', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    act(() => entorno.acciones().regresarSinCambiar());
    expect(entorno.estado().status).toBe('selecting');
  });
});

describe('elegirEmpresa durante un cambio', () => {
  it('el token de sesión se reemplaza solo cuando la elección se acepta', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    let liberar: () => void = () => {};
    const pausa = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    servidor.use(
      http.post('/api/auth/empresa/:id', async () => {
        await pausa;
        return HttpResponse.json({ token: 'token-de-sesion-b' });
      }),
    );
    let pendiente: Promise<void> = Promise.resolve();
    act(() => {
      pendiente = entorno.acciones().elegirEmpresa(EMPRESA_B);
    });
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    liberar();
    await act(() => pendiente);
    expect(entorno.almacen.sesion()).toBe('token-de-sesion-b');
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(entorno.estado()).toMatchObject({ restaurarOrigen: false });
    expect(entorno.tienda.obtener().epoca).toBe(2);
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('una empresa distinta vacía la caché', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
  });

  it('elegir la empresa ya activa equivale a regresar sin cambiar', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const antes = entorno.estado();
    await act(() => entorno.acciones().cambiarEmpresa());
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');
    const epoca = entorno.tienda.obtener().epoca;
    const eleccion = contar('POST', `/auth/empresa/${EMPRESA_A}`);
    const contexto = contar('GET', '/auth/contexto');
    try {
      await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
      await act(() => delay(20));
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(eleccion.n).toBe(0);
    expect(contexto.n).toBe(0);
    expect(entorno.tienda.obtener().epoca).toBe(epoca);
    expect(entorno.historial()).toEqual([
      'anonymous',
      'selecting',
      'loading',
      'ready',
      'selecting',
      'ready',
    ]);
    expect(entorno.estado()).toEqual(antes);
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBe('privado');
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('un fallo al elegir deja la sesión anterior viva y se puede abandonar', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    servidor.use(http.post('/api/auth/empresa/:id', () => error(500)));
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_B)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado()).toMatchObject({
      status: 'selecting',
      origen: 'cambio',
    });
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
    act(() => entorno.acciones().regresarSinCambiar());
    expect(entorno.estado().status).toBe('ready');
  });

  it('401 al elegir en un cambio: reingreso con el correo', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    servidor.use(http.post('/api/auth/empresa/:id', () => error(401)));
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_B)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'reingreso',
      email: CREDENCIALES.email,
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });
});

describe('elegirEmpresa: 401 y 403 en el paso de un login', () => {
  async function enSeleccion(entorno: EntornoSesion) {
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
  }

  it('401: seleccion_vencida con el correo', async () => {
    const { entorno } = montarSesion();
    await enSeleccion(entorno);
    servidor.use(http.post('/api/auth/empresa/:id', () => error(401)));
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_A)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'seleccion_vencida',
      email: CREDENCIALES.email,
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('403: rechaza con el 403 y deja la lista refrescada', async () => {
    const [primera, segunda] = EMPRESAS_DISPONIBLES;
    const { entorno } = montarSesion();
    await enSeleccion(entorno);
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () => HttpResponse.json([segunda])),
    );
    const llamadas = contar('GET', '/auth/empresas');
    let fallo: unknown;
    try {
      await act(async () => {
        await entorno
          .acciones()
          .elegirEmpresa(EMPRESA_A)
          .catch((e) => {
            fallo = e;
          });
      });
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(fallo).toBeInstanceOf(ApiError);
    expect((fallo as ApiError).statusCode).toBe(403);
    expect(llamadas.cabeceras).toEqual(['Bearer token-de-seleccion']);
    const estado = entorno.estado();
    expect(estado).toMatchObject({ status: 'selecting', origen: 'login' });
    if (estado.status !== 'selecting') return;
    expect(estado.empresas.map((e) => e.id)).toEqual([segunda?.id]);
    expect(estado.empresas.map((e) => e.id)).not.toContain(primera?.id);
    expect(entorno.almacen.sesion()).toBeNull();
  });

  it('403 con lista vacía: sin_empresas y vuelta al paso uno', async () => {
    const { entorno } = montarSesion();
    await enSeleccion(entorno);
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () => HttpResponse.json([])),
    );
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_A)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'sin_empresas',
      email: CREDENCIALES.email,
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('403 y 401 al refrescar: seleccion_vencida', async () => {
    const { entorno } = montarSesion();
    await enSeleccion(entorno);
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () => error(401)),
    );
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_A)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(entorno.estado()).toMatchObject({
      status: 'ended',
      motivo: 'seleccion_vencida',
    });
  });

  it('403 y fallo de red al refrescar: informa el 403 y deja la lista', async () => {
    const { entorno } = montarSesion();
    await enSeleccion(entorno);
    const antes = entorno.estado();
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () => HttpResponse.error()),
    );
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_A)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(entorno.estado()).toBe(antes);
  });

  it('403 en un cambio: refresca y sigue en selecting(cambio)', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () =>
        HttpResponse.json([EMPRESAS_DISPONIBLES[0]]),
      ),
    );
    await expect(
      act(() => entorno.acciones().elegirEmpresa(EMPRESA_B)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(entorno.estado()).toMatchObject({
      status: 'selecting',
      origen: 'cambio',
    });
    expect(entorno.almacen.sesion()).toBe('token-de-sesion');
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });
});

describe('refrescarEmpresas', () => {
  it('fuera de la selección no hace nada', async () => {
    const { entorno } = montarSesion();
    const llamadas = contar('GET', '/auth/empresas');
    try {
      await act(() => entorno.acciones().refrescarEmpresas());
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(llamadas.n).toBe(0);
  });

  it('con una lista vacía durante un cambio termina con sin_empresas', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    servidor.use(http.get('/api/auth/empresas', () => HttpResponse.json([])));
    await act(() => entorno.acciones().refrescarEmpresas());
    expect(entorno.estado()).toMatchObject({
      status: 'ended',
      motivo: 'sin_empresas',
    });
    esperarTokensCoherentes(entorno.tienda.obtener(), entorno.almacen);
  });

  it('cambia la lista y conserva el origen', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    servidor.use(
      http.get('/api/auth/empresas', () =>
        HttpResponse.json([EMPRESAS_DISPONIBLES[1]]),
      ),
    );
    await act(() => entorno.acciones().refrescarEmpresas());
    expect(entorno.estado()).toMatchObject({
      status: 'selecting',
      origen: 'cambio',
    });
  });
});
