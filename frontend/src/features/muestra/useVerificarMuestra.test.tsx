import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { clavesMuestra } from './claves';
import { useVerificarMuestra } from './useVerificarMuestra';

const RESPUESTA = {
  decisionId: 'dec-1',
  marca: 'conforme',
  marcadaPor: 'Jorge Tapia',
  marcadaAt: '2026-11-22T16:42:00.000Z',
};

function registrar(respuesta: () => Response | Promise<Response>) {
  const pedidos: Array<{ ruta: string; cuerpo: string }> = [];
  servidor.use(
    http.post('/api/muestra/casos/:id/verificar', async ({ request }) => {
      pedidos.push({
        ruta: new URL(request.url).pathname,
        cuerpo: await request.text(),
      });
      return respuesta();
    }),
  );
  return pedidos;
}

function montar() {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const hook = renderHook(useVerificarMuestra, {
    wrapper: envoltura(cliente, () => sesionConEpoca(1)),
  });
  return { invalidar, ...hook };
}

const PETICION = { decisionId: 'dec-1', resultado: 'conforme' } as const;

describe('useVerificarMuestra (historia 9.4)', () => {
  it('envía POST a /muestra/casos/:id/verificar con el resultado y relee la muestra', async () => {
    const pedidos = registrar(() =>
      HttpResponse.json(RESPUESTA, { status: 201 }),
    );
    const { result, invalidar } = montar();
    const alExito = vi.fn();
    act(() => {
      result.current.marcar(PETICION, alExito);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toEqual([
      {
        ruta: '/api/muestra/casos/dec-1/verificar',
        cuerpo: JSON.stringify({ resultado: 'conforme' }),
      },
    ]);
    expect(result.current.data).toEqual(RESPUESTA);
    expect(alExito).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: clavesMuestra.todas(1),
    });
  });

  it('un solo vuelo: una segunda marca mientras la primera viaja no se envía', async () => {
    const pedidos = registrar(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json(RESPUESTA, { status: 201 });
    });
    const { result } = montar();
    let primera = false;
    let segunda = true;
    act(() => {
      primera = result.current.marcar(PETICION);
      segunda = result.current.marcar({ ...PETICION, resultado: 'desacuerdo' });
    });
    expect(primera).toBe(true);
    expect(segunda).toBe(false);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toHaveLength(1);
  });

  it.each([403, 404, 409])(
    'un %i es un ApiError y también relee la muestra',
    async (estado) => {
      registrar(() =>
        HttpResponse.json(
          { statusCode: estado, message: 'x' },
          { status: estado },
        ),
      );
      const { result, invalidar } = montar();
      act(() => {
        result.current.marcar(PETICION);
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect((result.current.error as ApiError).statusCode).toBe(estado);
      await waitFor(() =>
        expect(invalidar).toHaveBeenCalledWith({
          queryKey: clavesMuestra.todas(1),
        }),
      );
    },
  );

  it('un cuerpo fuera de contrato es un error', async () => {
    registrar(() =>
      HttpResponse.json({ ...RESPUESTA, marca: 'pendiente' }, { status: 201 }),
    );
    const { result } = montar();
    act(() => {
      result.current.marcar(PETICION);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
