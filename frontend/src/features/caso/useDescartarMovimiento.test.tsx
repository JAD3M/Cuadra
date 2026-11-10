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
import { servidor } from '@/test/servidor';
import {
  useDeshacerDescarte,
  useDescartarMovimiento,
} from './useDescartarMovimiento';

const RESPUESTA = (estado: 'descartada' | 'reabierta') => ({
  id: idDe(9000),
  movimientoId: idDe(1),
  estado,
  motivo: 'Comisión bancaria',
});

interface Registro {
  ruta: string;
  cuerpo: string;
}

function registrar(
  ruta: 'descartar' | 'deshacer-descarte',
  respuesta: () => Response | Promise<Response>,
) {
  const pedidos: Registro[] = [];
  servidor.use(
    http.post(`/api/movimientos/:id/${ruta}`, async ({ request }) => {
      pedidos.push({
        ruta: new URL(request.url).pathname,
        cuerpo: await request.text(),
      });
      return respuesta();
    }),
  );
  return pedidos;
}

function montar<T>(usar: () => T, epoca = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const hook = renderHook(usar, {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

describe('useDescartarMovimiento', () => {
  it('envía POST a /movimientos/:id/descartar con el motivo recortado', async () => {
    const pedidos = registrar('descartar', () =>
      HttpResponse.json(RESPUESTA('descartada')),
    );
    const { result } = montar(useDescartarMovimiento);
    act(() => {
      result.current.descartar({
        movimientoId: idDe(1),
        motivo: '  Comisión bancaria  ',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      {
        ruta: `/api/movimientos/${idDe(1)}/descartar`,
        cuerpo: '{"motivo":"Comisión bancaria"}',
      },
    ]);
    expect(result.current.data?.estado).toBe('descartada');
  });

  it('al terminar invalida el caso y la bandeja de la época', async () => {
    registrar('descartar', () => HttpResponse.json(RESPUESTA('descartada')));
    const { result, invalidar } = montar(useDescartarMovimiento, () => 3);
    act(() => {
      result.current.descartar({ movimientoId: idDe(1), motivo: 'x' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const claves = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(claves).toEqual([
      ['caso', 3],
      ['bandeja', 3],
    ]);
  });

  it('un doble disparo envía una sola petición', async () => {
    const pedidos = registrar('descartar', async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA('descartada'));
    });
    const { result } = montar(useDescartarMovimiento);
    let enviadas: boolean[] = [];
    act(() => {
      const p = { movimientoId: idDe(1), motivo: 'x' };
      enviadas = [result.current.descartar(p), result.current.descartar(p)];
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enviadas).toEqual([true, false]);
    expect(pedidos).toHaveLength(1);
  });

  it('un cambio de época en vuelo no invalida nada', async () => {
    registrar('descartar', async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA('descartada'));
    });
    let epoca = 1;
    const { result, invalidar, rerender } = montar(
      useDescartarMovimiento,
      () => epoca,
    );
    act(() => {
      result.current.descartar({ movimientoId: idDe(1), motivo: 'x' });
    });
    epoca = 2;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it.each([403, 404, 409])(
    'expone el status %i como ApiError, sin invalidar',
    async (status) => {
      registrar('descartar', () =>
        HttpResponse.json({ statusCode: status }, { status }),
      );
      const { result, invalidar } = montar(useDescartarMovimiento);
      act(() => {
        result.current.descartar({ movimientoId: idDe(1), motivo: 'x' });
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).statusCode).toBe(status);
      expect(invalidar).not.toHaveBeenCalled();
    },
  );

  it('un 200 ilegible es ContratoError y vuelve a pedir el caso', async () => {
    registrar('descartar', () => HttpResponse.json({ raro: true }));
    const { result, invalidar } = montar(useDescartarMovimiento);
    act(() => {
      result.current.descartar({ movimientoId: idDe(1), motivo: 'x' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['caso', 1] });
  });
});

describe('useDeshacerDescarte', () => {
  it('envía POST a /movimientos/:id/deshacer-descarte sin cuerpo', async () => {
    const pedidos = registrar('deshacer-descarte', () =>
      HttpResponse.json(RESPUESTA('reabierta')),
    );
    const { result, invalidar } = montar(useDeshacerDescarte);
    act(() => {
      result.current.deshacer({ movimientoId: idDe(1) });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      {
        ruta: `/api/movimientos/${idDe(1)}/deshacer-descarte`,
        cuerpo: '',
      },
    ]);
    expect(result.current.data?.estado).toBe('reabierta');
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['caso', 1],
      ['bandeja', 1],
    ]);
  });

  it.each([403, 409])('expone el status %i como ApiError', async (status) => {
    registrar('deshacer-descarte', () =>
      HttpResponse.json({ statusCode: status }, { status }),
    );
    const { result } = montar(useDeshacerDescarte);
    act(() => {
      result.current.deshacer({ movimientoId: idDe(1) });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).statusCode).toBe(status);
  });
});
