import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinRastroDeSesion } from '@/test/invariantesSesion';
import {
  CREDENCIALES,
  EMPRESA_A,
  EMPRESA_B,
  montarSesion,
} from '@/test/montarSesion';
import { servidor } from '@/test/servidor';
import {
  empresasFalla,
  empresasLista,
  espiarSolicitudes,
  seleccionFalla,
} from '@/test/handlersAuth';
import { EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import { sesionConEmpresa, sesionSinEmpresa } from '@/test/sesionMock';
import { claveContexto } from './acciones';

/** Consultas que conservan datos: la caché vaciada no debe tener ninguna. */
function consultasConDatos(consultas: QueryClient) {
  return consultas
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.data !== undefined);
}

// Recargar la página pierde la memoria de JavaScript, no la cookie: al montar
// el proveedor pregunta al servidor qué sesión hay (Story 1.1, FR-59).

describe('restauración de la sesión al recargar', () => {
  it('sin cookie: pasa por restoring y termina en anonymous', async () => {
    servidor.use(http.get('/api/auth/contexto', () => delay(30)));
    const { entorno } = montarSesion({ recarga: true });
    expect(entorno.estado().status).toBe('restoring');
    await waitFor(() => expect(entorno.estado().status).toBe('anonymous'));
    esperarSinRastroDeSesion();
  });

  it('con sesión y empresa: restaura el contexto sin pasar por el login', async () => {
    sesionConEmpresa(EMPRESA_A);
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    const estado = entorno.estado();
    if (estado.status !== 'ready') return;
    expect(estado.contexto.empresa.id).toBe(EMPRESA_A);
    expect(estado.contexto.usuario.nombre).toBe('Jorge Tapia');
    expect(estado.restaurarOrigen).toBe(true);
    // El contexto ya está en la caché: no se pide dos veces.
    await act(async () => {});
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(1);
    expect(espia.cuantas('POST', '/api/auth/login')).toBe(0);
    expect(
      entorno.consultas.getQueryData(claveContexto(estado.epoca)),
    ).toBeDefined();
    espia.detener();
    esperarSinRastroDeSesion();
  });

  it('con sesión sin empresa: retoma el paso de elegir empresa', async () => {
    sesionSinEmpresa();
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('selecting'));
    const estado = entorno.estado();
    if (estado.status !== 'selecting') return;
    expect(estado.origen).toBe('login');
    expect(estado.empresas).toHaveLength(2);
    expect(estado.usuario).toBeNull();

    // Desde ahí se elige empresa como tras un login normal.
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    esperarSinRastroDeSesion();
  });

  it('un 401 en el contexto y en la lista de empresas deja anónimo', async () => {
    servidor.use(
      http.get('/api/auth/empresas', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'y' },
          { status: 401 },
        ),
      ),
    );
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('anonymous'));
  });

  it('una lista de empresas vacía deja anónimo', async () => {
    sesionSinEmpresa();
    servidor.use(http.get('/api/auth/empresas', () => HttpResponse.json([])));
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('anonymous'));
  });

  it('un 403 en el contexto termina con sin_acceso', async () => {
    servidor.use(
      http.get('/api/auth/contexto', () =>
        HttpResponse.json(
          { statusCode: 403, error: 'x', message: 'y' },
          { status: 403 },
        ),
      ),
    );
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() =>
      expect(entorno.estado()).toEqual({
        status: 'ended',
        motivo: 'sin_acceso',
      }),
    );
  });

  it('un fallo de red al restaurar deja anónimo en vez de colgarse', async () => {
    servidor.use(http.get('/api/auth/contexto', () => HttpResponse.error()));
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('anonymous'));
  });

  it('con StrictMode restaura una sola vez y llega a ready', async () => {
    sesionConEmpresa(EMPRESA_A);
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion({ recarga: true, estricto: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(1);
    espia.detener();
  });

  it('las peticiones de restauración mandan la cookie y ninguna Authorization', async () => {
    sesionConEmpresa(EMPRESA_A);
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    espia.detener();
    expect(espia.solicitudes.length).toBeGreaterThan(0);
    for (const s of espia.solicitudes) {
      expect(s.autorizacion).toBeNull();
      expect(s.credenciales).toBe('include');
    }
  });
});

describe('cierre de sesión por el servidor', () => {
  it('cerrarSesion llama a POST /auth/logout, vacía la caché y termina', async () => {
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    expect(entorno.consultas.getQueryCache().getAll().length).toBeGreaterThan(
      0,
    );

    await act(() => entorno.acciones().cerrarSesion());
    expect(espia.cuantas('POST', '/api/auth/logout')).toBe(1);
    expect(entorno.estado()).toEqual({
      status: 'ended',
      motivo: 'cierre_voluntario',
    });
    expect(consultasConDatos(entorno.consultas)).toEqual([]);
    espia.detener();
    esperarSinRastroDeSesion();
  });

  it('si el logout falla por red igual limpia el estado del cliente', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    servidor.use(http.post('/api/auth/logout', () => HttpResponse.error()));
    await act(() => entorno.acciones().cerrarSesion());
    expect(entorno.estado().status).toBe('ended');
    expect(consultasConDatos(entorno.consultas)).toEqual([]);
  });

  it('el logout no termina la sesión dos veces si ya terminó', async () => {
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().cerrarSesion());
    expect(espia.cuantas('POST', '/api/auth/logout')).toBe(0);
    espia.detener();
  });
});

describe('elegir empresa aplica el contexto devuelto', () => {
  it('el POST de elegir empresa trae el contexto y no se vuelve a pedir', async () => {
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    // `ready` sin esperar a ninguna consulta de contexto.
    expect(entorno.estado().status).toBe('ready');
    await act(async () => {});
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(0);
    const estado = entorno.estado();
    if (estado.status !== 'ready') return;
    expect(estado.contexto.empresa.id).toBe(EMPRESA_A);
    espia.detener();
    esperarSinRastroDeSesion();
  });
});

describe('cambio de empresa tras recargar', () => {
  function listoParaCambiar(
    estado: ReturnType<typeof montarSesion>['entorno'],
  ) {
    const actual = estado.estado();
    return actual.status === 'ready' && actual.puedeCambiarEmpresa;
  }

  it('con varias empresas, puedeCambiarEmpresa es true sin volver a entrar', async () => {
    sesionConEmpresa(EMPRESA_A);
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    await waitFor(() => expect(listoParaCambiar(entorno)).toBe(true));
  });

  it('con una sola empresa, puedeCambiarEmpresa sigue en false', async () => {
    sesionConEmpresa(EMPRESA_A);
    empresasLista([EMPRESAS_DISPONIBLES[0]!]);
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/auth/empresas')).toBe(1),
    );
    await act(async () => {});
    const estado = entorno.estado();
    expect(estado).toMatchObject({
      status: 'ready',
      puedeCambiarEmpresa: false,
    });
    espia.detener();
  });

  it.each([401, 500])(
    'si la lista responde %i, la sesión sigue y no se puede cambiar',
    async (status) => {
      sesionConEmpresa(EMPRESA_A);
      empresasFalla(status);
      const espia = espiarSolicitudes();
      const { entorno } = montarSesion({ recarga: true });
      await waitFor(() => expect(entorno.estado().status).toBe('ready'));
      await waitFor(() =>
        expect(espia.cuantas('GET', '/api/auth/empresas')).toBeGreaterThan(0),
      );
      await act(async () => {});
      expect(entorno.estado()).toMatchObject({
        status: 'ready',
        puedeCambiarEmpresa: false,
      });
      espia.detener();
    },
  );

  it('cambiar aplica el contexto devuelto y vacía la caché de la empresa anterior', async () => {
    sesionConEmpresa(EMPRESA_A);
    const espia = espiarSolicitudes();
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(listoParaCambiar(entorno)).toBe(true));
    entorno.consultas.setQueryData(['dato-ajeno'], 'privado');

    await act(() => entorno.acciones().cambiarEmpresa());
    expect(entorno.estado().status).toBe('selecting');
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_B));

    const estado = entorno.estado();
    expect(estado).toMatchObject({ status: 'ready', restaurarOrigen: false });
    if (estado.status !== 'ready') return;
    expect(estado.contexto.empresa.id).toBe(EMPRESA_B);
    expect(estado.puedeCambiarEmpresa).toBe(true);
    expect(entorno.consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    expect(espia.cuantas('POST', '/api/auth/empresa/' + EMPRESA_B)).toBe(1);
    espia.detener();
  });

  it('un 403 al cambiar conserva la sesión actual', async () => {
    sesionConEmpresa(EMPRESA_A);
    const { entorno } = montarSesion({ recarga: true });
    await waitFor(() => expect(listoParaCambiar(entorno)).toBe(true));
    await act(() => entorno.acciones().cambiarEmpresa());
    seleccionFalla(403);

    await act(async () => {
      await expect(
        entorno.acciones().elegirEmpresa(EMPRESA_B),
      ).rejects.toBeDefined();
    });
    expect(entorno.estado().status).toBe('selecting');

    act(() => entorno.acciones().regresarSinCambiar());
    const estado = entorno.estado();
    expect(estado.status).toBe('ready');
    if (estado.status !== 'ready') return;
    expect(estado.contexto.empresa.id).toBe(EMPRESA_A);
  });
});
