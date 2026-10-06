import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { idDe } from '@/test/fixturesBandeja';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { casoSugerencia } from '@/test/fixturesCaso';
import { servidor } from '@/test/servidor';
import { useCaso } from './useCaso';
import { useResolverCaso } from './useResolverCaso';

const RESPUESTA = (estado: 'confirmada' | 'rechazada') => ({
  id: idDe(5001),
  estado,
  cfdiId: idDe(7001),
  movimientoId: idDe(1),
  motivo: null,
  confirmadaAt: estado === 'confirmada' ? '2026-10-05T10:00:00.000Z' : null,
  rechazadasAutomaticamente: [],
});

interface Registro {
  ruta: string;
  cuerpo: string;
}

function registrar(
  respuesta: () => Response | Promise<Response> = () =>
    HttpResponse.json(RESPUESTA('confirmada')),
) {
  const pedidos: Registro[] = [];
  servidor.use(
    http.post('/api/conciliaciones/:id/:accion', async ({ request }) => {
      pedidos.push({
        ruta: new URL(request.url).pathname,
        cuerpo: await request.text(),
      });
      return respuesta();
    }),
  );
  return pedidos;
}

function montar(epoca = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const hook = renderHook(() => useResolverCaso(), {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

describe('useResolverCaso', () => {
  it('confirma con POST a la conciliación y sin cuerpo', async () => {
    const pedidos = registrar();
    const { result } = montar();
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      { ruta: `/api/conciliaciones/${idDe(5001)}/confirmar`, cuerpo: '' },
    ]);
    expect(result.current.data?.estado).toBe('confirmada');
  });

  it('rechaza siempre con un objeto JSON: {} sin motivo', async () => {
    const pedidos = registrar(() => HttpResponse.json(RESPUESTA('rechazada')));
    const { result } = montar();
    act(() => {
      result.current.resolver({
        accion: 'rechazar',
        conciliacionId: idDe(5001),
        motivo: '   ',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos[0]?.ruta).toBe(`/api/conciliaciones/${idDe(5001)}/rechazar`);
    expect(pedidos[0]?.cuerpo).toBe('{}');
  });

  it('rechaza con el motivo recortado', async () => {
    const pedidos = registrar(() => HttpResponse.json(RESPUESTA('rechazada')));
    const { result } = montar();
    act(() => {
      result.current.resolver({
        accion: 'rechazar',
        conciliacionId: idDe(5001),
        motivo: '  Monto no corresponde  ',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos[0]?.cuerpo).toBe('{"motivo":"Monto no corresponde"}');
  });

  it('un doble disparo envía una sola petición', async () => {
    const pedidos = registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA('confirmada'));
    });
    const { result } = montar();
    let enviadas: boolean[] = [];
    act(() => {
      enviadas = [
        result.current.resolver({
          accion: 'confirmar',
          conciliacionId: idDe(5001),
        }),
        result.current.resolver({
          accion: 'confirmar',
          conciliacionId: idDe(5001),
        }),
      ];
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enviadas).toEqual([true, false]);
    expect(pedidos).toHaveLength(1);
  });

  it('permite otra petición tras fallar la primera', async () => {
    let n = 0;
    const pedidos = registrar(() =>
      ++n === 1
        ? HttpResponse.json({ statusCode: 500 }, { status: 500 })
        : HttpResponse.json(RESPUESTA('confirmada')),
    );
    const { result } = montar();
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toHaveLength(2);
  });

  it('un cambio de época en vuelo no invalida nada', async () => {
    registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA('confirmada'));
    });
    let epoca = 1;
    const { result, invalidar, rerender } = montar(() => epoca);
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    epoca = 2;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
    // La época guardada es la de la activación: la pantalla puede descartarla.
    expect(result.current.variables?.epoca).toBe(1);
  });

  it('no envía sin época (sesión no lista)', async () => {
    const pedidos = registrar();
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useResolverCaso(), {
      wrapper: envoltura(cliente, () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    let enviada = true;
    act(() => {
      enviada = result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    expect(enviada).toBe(false);
    expect(pedidos).toHaveLength(0);
  });

  it.each([400, 403, 404, 409, 500])(
    'expone el status %i como ApiError, sin reintentar',
    async (status) => {
      const pedidos = registrar(() =>
        HttpResponse.json({ statusCode: status }, { status }),
      );
      const { result, invalidar } = montar();
      act(() => {
        result.current.resolver({
          accion: 'rechazar',
          conciliacionId: idDe(5001),
        });
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).statusCode).toBe(status);
      expect(pedidos).toHaveLength(1);
      expect(invalidar).not.toHaveBeenCalled();
    },
  );

  it('un fallo de red es un error y no invalida', async () => {
    registrar(() => HttpResponse.error());
    const { result, invalidar } = montar();
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('un 200 con cuerpo inválido es ContratoError y refresca solo el caso', async () => {
    registrar(() => HttpResponse.json({ estado: 'otra' }));
    const { result, invalidar } = montar();
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['caso', 1],
    ]);
  });

  it('al tener éxito se queda pendiente hasta que el caso se vuelve a pedir', async () => {
    registrar();
    let lecturas = 0;
    servidor.use(
      http.get('/api/casos/:id', async () => {
        lecturas += 1;
        if (lecturas > 1) await delay(80);
        return HttpResponse.json(casoSugerencia());
      }),
    );
    const cliente = clienteDePruebas();
    const { result } = renderHook(
      () => ({
        caso: useCaso(idDe(1)),
        resolucion: useResolverCaso(),
      }),
      { wrapper: envoltura(cliente) },
    );
    await waitFor(() => expect(result.current.caso.isSuccess).toBe(true));
    act(() => {
      result.current.resolucion.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(lecturas).toBe(2));
    // La respuesta ya llegó pero el refetch del caso sigue en curso.
    expect(result.current.resolucion.isPending).toBe(true);
    await waitFor(() => expect(result.current.resolucion.isSuccess).toBe(true));
    expect(result.current.caso.isFetching).toBe(false);
  });

  it('al tener éxito invalida el caso y la bandeja de la época', async () => {
    registrar();
    const { invalidar, result } = montar();
    act(() => {
      result.current.resolver({
        accion: 'confirmar',
        conciliacionId: idDe(5001),
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['caso', 1],
      ['bandeja', 1],
    ]);
  });
});
