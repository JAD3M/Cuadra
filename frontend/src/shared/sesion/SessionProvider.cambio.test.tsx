import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, api } from '@/shared/api';
import { CONTEXTO_SESION_B, EMPRESAS_DISPONIBLES } from '@/test/fixtures';
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

/** Cuenta las peticiones a una ruta (método y ruta exactos). */
function contar(metodo: string, ruta: string) {
  const cuenta = {
    n: 0,
    cabeceras: [] as { autorizacion: string | null; credenciales: string }[],
  };
  servidor.events.on('request:start', ({ request }) => {
    if (
      request.method === metodo &&
      new URL(request.url).pathname === `/api${ruta}`
    ) {
      cuenta.n += 1;
      cuenta.cabeceras.push({
        autorizacion: request.headers.get('Authorization'),
        credenciales: request.credentials,
      });
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
  it('pide la lista con la cookie y pasa a selecting(cambio)', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const llamadas = contar('GET', '/auth/empresas');
    try {
      await act(() => entorno.acciones().cambiarEmpresa());
    } finally {
      servidor.events.removeAllListeners();
    }
    expect(llamadas.cabeceras).toEqual([
      { autorizacion: null, credenciales: 'include' },
    ]);
    const estado = entorno.estado();
    expect(estado).toMatchObject({ status: 'selecting', origen: 'cambio' });
    if (estado.status !== 'selecting') return;
    expect(estado.empresas).toHaveLength(EMPRESAS_DISPONIBLES.length);
    expect(JSON.stringify(estado).toLowerCase()).not.toContain('token');
  });

  it('expone la empresa activa solo durante el cambio, no en el login', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    const enLogin = entorno.estado();
    expect(enLogin.status).toBe('selecting');
    expect(enLogin).not.toHaveProperty('empresaActual');
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    await act(() => entorno.acciones().cambiarEmpresa());
    const enCambio = entorno.estado();
    if (enCambio.status !== 'selecting') throw new Error('sin cambio');
    expect(enCambio.empresaActual).toMatchObject({ id: EMPRESA_A });
    expect(enCambio.empresaActual?.razonSocial).toBeTruthy();
    expect(JSON.stringify(enCambio).toLowerCase()).not.toContain('token');
  });

  it('conserva la sesión viva (SA-1) y no cambia la época', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    const epoca = entorno.tienda.obtener().epoca;
    await act(() => entorno.acciones().cambiarEmpresa());
    // La empresa activa sigue siendo la de la sesión viva.
    expect(entorno.tienda.obtener()).toMatchObject({
      fase: 'selecting',
      origen: 'cambio',
      empresaId: EMPRESA_A,
    });
    expect(entorno.tienda.obtener().epoca).toBe(epoca);
    esperarSinRastroDeSesion();
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

  it('durante el cambio las llamadas siguen mandando la cookie de la sesión viva', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    const cabeceras: { autorizacion: string | null; credenciales: string }[] =
      [];
    servidor.use(
      http.get('/api/prueba', ({ request }) => {
        cabeceras.push({
          autorizacion: request.headers.get('Authorization'),
          credenciales: request.credentials,
        });
        return HttpResponse.json({});
      }),
    );
    await api.fetch('/prueba');
    expect(cabeceras).toEqual([
      { autorizacion: null, credenciales: 'include' },
    ]);
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
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    esperarSinRastroDeSesion();
  });

  it('cerrar sesión durante el cambio cancela la sesión viva', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    await act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'cierre_voluntario',
    });
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
  });

  it('401 en la lista: además pide al servidor cancelar la sesión', async () => {
    const { entorno } = montarSesion();
    await listo(entorno);
    servidor.use(http.get('/api/auth/empresas', () => error(401)));
    const logout = contar('POST', '/auth/logout');
    try {
      await expect(
        act(() => entorno.acciones().cambiarEmpresa()),
      ).rejects.toBeInstanceOf(ApiError);
      await waitFor(() => expect(logout.n).toBe(1));
    } finally {
      servidor.events.removeAllListeners();
    }
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
    expect(entorno.tienda.obtener().fase).toBe('sesion');
    esperarSinRastroDeSesion();
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

  it('tras recargar no se conoce el correo: el reingreso llega sin él', async () => {
    sesionConEmpresa(EMPRESA_A);
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    // Con la sesión que ya eligió empresa el servidor responde 401 a la lista.
    servidor.use(http.get('/api/auth/empresas', () => error(401)));
    await expect(
      act(() => entorno.acciones().cambiarEmpresa()),
    ).rejects.toBeInstanceOf(ApiError);
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
    await act(() => entorno.acciones().cerrarSesion());
    await act(() => pendiente);
    expect(entorno.estado().status).toBe('ended');
    esperarSinRastroDeSesion();
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
      'ready',
      'selecting',
      'ready',
    ]);
    expect(entorno.estado()).toEqual(antes);
    expect(contexto.n).toBe(0);
    esperarSinRastroDeSesion();
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
  it('la sesión se reemplaza solo cuando la elección se acepta', async () => {
    const { entorno } = montarSesion();
    await enCambio(entorno);
    let liberar: () => void = () => {};
    const pausa = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    servidor.use(
      http.post('/api/auth/empresa/:id', async () => {
        await pausa;
        return HttpResponse.json(CONTEXTO_SESION_B);
      }),
    );
    let pendiente: Promise<void> = Promise.resolve();
    act(() => {
      pendiente = entorno.acciones().elegirEmpresa(EMPRESA_B);
    });
    // Mientras el servidor no acepta, la sesión de A sigue siendo la viva.
    expect(entorno.tienda.obtener()).toMatchObject({
      fase: 'selecting',
      empresaId: EMPRESA_A,
    });
    liberar();
    await act(() => pendiente);
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    // Se aplica el contexto que devolvió el servidor: el de B.
    expect(entorno.estado()).toMatchObject({
      restaurarOrigen: false,
      contexto: CONTEXTO_SESION_B,
    });
    expect(entorno.tienda.obtener().epoca).toBe(2);
    esperarSinRastroDeSesion();
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
      'ready',
      'selecting',
      'ready',
    ]);
    expect(entorno.estado()).toEqual(antes);
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBe('privado');
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
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
    expect(llamadas.cabeceras).toEqual([
      { autorizacion: null, credenciales: 'include' },
    ]);
    const estado = entorno.estado();
    expect(estado).toMatchObject({ status: 'selecting', origen: 'login' });
    if (estado.status !== 'selecting') return;
    expect(estado.empresas.map((e) => e.id)).toEqual([segunda?.id]);
    expect(estado.empresas.map((e) => e.id)).not.toContain(primera?.id);
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
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
    expect(entorno.tienda.obtener().fase).toBe('selecting');
    esperarSinRastroDeSesion();
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
    esperarSinRastroDeSesion();
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
