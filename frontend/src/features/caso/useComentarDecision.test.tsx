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
import { useComentarDecision } from './useComentarDecision';

const RESPUESTA = {
  id: idDe(9001),
  decisionId: idDe(5001),
  texto: 'Parece de otra obra',
  por: 'Jorge Tapia',
  fecha: '2026-10-05T16:40:00.000Z',
};

interface Registro {
  ruta: string;
  cuerpo: string;
}

function registrar(respuesta: () => Response | Promise<Response>) {
  const pedidos: Registro[] = [];
  servidor.use(
    http.post('/api/conciliaciones/:id/comentarios', async ({ request }) => {
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
  const hook = renderHook(useComentarDecision, {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

const PETICION = { decisionId: idDe(5001), texto: 'x' };

describe('useComentarDecision', () => {
  it('envía POST a /conciliaciones/:id/comentarios con el texto recortado', async () => {
    const pedidos = registrar(() =>
      HttpResponse.json(RESPUESTA, { status: 201 }),
    );
    const { result } = montar();
    act(() => {
      result.current.comentar({
        decisionId: idDe(5001),
        texto: '  Parece de otra obra  ',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      {
        ruta: `/api/conciliaciones/${idDe(5001)}/comentarios`,
        cuerpo: '{"texto":"Parece de otra obra"}',
      },
    ]);
    expect(result.current.data?.por).toBe('Jorge Tapia');
  });

  it('al terminar invalida el caso (con su historial) de la época', async () => {
    registrar(() => HttpResponse.json(RESPUESTA, { status: 201 }));
    const { result, invalidar } = montar(() => 3);
    act(() => {
      result.current.comentar(PETICION);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toContainEqual([
      'caso',
      3,
    ]);
  });

  it('un doble disparo envía una sola petición', async () => {
    const pedidos = registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA, { status: 201 });
    });
    const { result } = montar();
    let enviadas: boolean[] = [];
    act(() => {
      enviadas = [
        result.current.comentar(PETICION),
        result.current.comentar(PETICION),
      ];
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enviadas).toEqual([true, false]);
    expect(pedidos).toHaveLength(1);
  });

  it('un cambio de época en vuelo no invalida nada', async () => {
    registrar(async () => {
      await delay(40);
      return HttpResponse.json(RESPUESTA, { status: 201 });
    });
    let epoca = 1;
    const { result, invalidar, rerender } = montar(() => epoca);
    act(() => {
      result.current.comentar(PETICION);
    });
    epoca = 2;
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404])(
    'expone el status %i como ApiError, sin invalidar',
    async (status) => {
      registrar(() => HttpResponse.json({ statusCode: status }, { status }));
      const { result, invalidar } = montar();
      act(() => {
        result.current.comentar(PETICION);
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).statusCode).toBe(status);
      expect(invalidar).not.toHaveBeenCalled();
    },
  );

  it('un 201 ilegible es ContratoError y vuelve a pedir el caso', async () => {
    registrar(() => HttpResponse.json({ raro: true }, { status: 201 }));
    const { result, invalidar } = montar();
    act(() => {
      result.current.comentar(PETICION);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['caso', 1] });
  });
});
