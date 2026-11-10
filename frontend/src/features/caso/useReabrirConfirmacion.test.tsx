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
import { useReabrirConfirmacion } from './useReabrirConfirmacion';

const RESPUESTA = {
  id: idDe(5001),
  estado: 'reabierta',
  movimientoId: idDe(1),
  cfdiIds: [idDe(7001)],
  motivo: 'Confirmé el CFDI equivocado',
};

interface Registro {
  ruta: string;
  cuerpo: string;
}

function registrar(respuesta: () => Response | Promise<Response>) {
  const pedidos: Registro[] = [];
  servidor.use(
    http.post('/api/conciliaciones/:id/reabrir', async ({ request }) => {
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
  const hook = renderHook(useReabrirConfirmacion, {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

const PETICION = { conciliacionId: idDe(5001), motivo: 'x' };

describe('useReabrirConfirmacion', () => {
  it('envía POST a /conciliaciones/:id/reabrir con el motivo recortado', async () => {
    const pedidos = registrar(() => HttpResponse.json(RESPUESTA));
    const { result } = montar();
    act(() => {
      result.current.reabrir({
        conciliacionId: idDe(5001),
        motivo: '  Confirmé el CFDI equivocado  ',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      {
        ruta: `/api/conciliaciones/${idDe(5001)}/reabrir`,
        cuerpo: '{"motivo":"Confirmé el CFDI equivocado"}',
      },
    ]);
    expect(result.current.data?.estado).toBe('reabierta');
  });

  it('al terminar invalida el caso (con su historial) y la bandeja de la época', async () => {
    registrar(() => HttpResponse.json(RESPUESTA));
    const { result, invalidar } = montar(() => 3);
    act(() => {
      result.current.reabrir(PETICION);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['caso', 3],
      ['bandeja', 3],
    ]);
  });

  it('un doble disparo envía una sola petición', async () => {
    const pedidos = registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA);
    });
    const { result } = montar();
    let enviadas: boolean[] = [];
    act(() => {
      enviadas = [
        result.current.reabrir(PETICION),
        result.current.reabrir(PETICION),
      ];
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enviadas).toEqual([true, false]);
    expect(pedidos).toHaveLength(1);
  });

  it('un cambio de época en vuelo no invalida nada', async () => {
    registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA);
    });
    let epoca = 1;
    const { result, invalidar, rerender } = montar(() => epoca);
    act(() => {
      result.current.reabrir(PETICION);
    });
    epoca = 2;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it.each([403, 404, 409])(
    'expone el status %i como ApiError, sin invalidar',
    async (status) => {
      registrar(() => HttpResponse.json({ statusCode: status }, { status }));
      const { result, invalidar } = montar();
      act(() => {
        result.current.reabrir(PETICION);
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).statusCode).toBe(status);
      expect(invalidar).not.toHaveBeenCalled();
    },
  );

  it('un 200 ilegible es ContratoError y vuelve a pedir el caso', async () => {
    registrar(() => HttpResponse.json({ raro: true }));
    const { result, invalidar } = montar();
    act(() => {
      result.current.reabrir(PETICION);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['caso', 1] });
  });
});
