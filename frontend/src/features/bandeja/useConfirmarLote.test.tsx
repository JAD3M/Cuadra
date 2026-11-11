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
import { useConfirmarLote } from './useConfirmarLote';

const LOTE = idDe(9001);

function registrar(
  respuesta: () => Response | Promise<Response> = () =>
    HttpResponse.json({ loteId: LOTE, confirmadas: [idDe(1)], omitidas: [] }),
) {
  const pedidos: Array<{ ruta: string; cuerpo: string }> = [];
  servidor.use(
    http.post('/api/conciliaciones/lotes', async ({ request }) => {
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
  const hook = renderHook(() => useConfirmarLote(), {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

const llamadas = () => ({ onExito: vi.fn(), onFallo: vi.fn() });

describe('useConfirmarLote (5.3)', () => {
  it('manda POST a /conciliaciones/lotes con los ids y entrega la respuesta', async () => {
    const pedidos = registrar();
    const { result } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1), idDe(2)], cb);
    });
    await waitFor(() => expect(cb.onExito).toHaveBeenCalledTimes(1));
    expect(pedidos).toEqual([
      {
        ruta: '/api/conciliaciones/lotes',
        cuerpo: JSON.stringify({ ids: [idDe(1), idDe(2)] }),
      },
    ]);
    expect(cb.onExito).toHaveBeenCalledWith({
      loteId: LOTE,
      confirmadas: [idDe(1)],
      omitidas: [],
    });
    expect(cb.onFallo).not.toHaveBeenCalled();
  });

  it('con desmarcadas las manda en el cuerpo, además de los ids (6.2)', async () => {
    const pedidos = registrar();
    const { result } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb, [idDe(2)]);
    });
    await waitFor(() => expect(cb.onExito).toHaveBeenCalledTimes(1));
    expect(pedidos).toEqual([
      {
        ruta: '/api/conciliaciones/lotes',
        cuerpo: JSON.stringify({ ids: [idDe(1)], desmarcadas: [idDe(2)] }),
      },
    ]);
  });

  it('sin ids pero con desmarcadas envía solo las desmarcadas (6.2)', async () => {
    const pedidos = registrar();
    const { result } = montar();
    const cb = llamadas();
    let envio = false;
    act(() => {
      envio = result.current.confirmar([], cb, [idDe(2)]);
    });
    expect(envio).toBe(true);
    await waitFor(() => expect(cb.onExito).toHaveBeenCalledTimes(1));
    expect(pedidos).toEqual([
      {
        ruta: '/api/conciliaciones/lotes',
        cuerpo: JSON.stringify({ ids: [], desmarcadas: [idDe(2)] }),
      },
    ]);
  });

  it('sin ids ni desmarcadas no envía nada', () => {
    const pedidos = registrar();
    const { result } = montar();
    let envio = true;
    act(() => {
      envio = result.current.confirmar([], llamadas());
    });
    expect(envio).toBe(false);
    expect(pedidos).toEqual([]);
  });

  it('la guarda evita un segundo envío mientras el primero está en vuelo', async () => {
    const pedidos = registrar(async () => {
      await delay(50);
      return HttpResponse.json({ loteId: LOTE, confirmadas: [], omitidas: [] });
    });
    const { result } = montar();
    const cb = llamadas();
    let primero = false;
    let segundo = true;
    act(() => {
      primero = result.current.confirmar([idDe(1)], cb);
      segundo = result.current.confirmar([idDe(1)], cb);
    });
    expect(primero).toBe(true);
    expect(segundo).toBe(false);
    await waitFor(() => expect(cb.onExito).toHaveBeenCalledTimes(1));
    expect(pedidos).toHaveLength(1);
  });

  it('tras el éxito refresca la bandeja y los casos de la época', async () => {
    registrar();
    const { result, invalidar } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb);
    });
    await waitFor(() => expect(cb.onExito).toHaveBeenCalled());
    await waitFor(() => {
      const claves = invalidar.mock.calls.map(
        (c) => (c[0]?.queryKey as unknown[])?.[0],
      );
      expect(claves).toContain('bandeja');
      expect(claves).toContain('caso');
    });
  });

  it('un error HTTP avisa con el error y también vuelve a mirar la bandeja', async () => {
    registrar(() => HttpResponse.json({ message: 'x' }, { status: 500 }));
    const { result, invalidar } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb);
    });
    await waitFor(() => expect(cb.onFallo).toHaveBeenCalledTimes(1));
    expect(cb.onFallo.mock.calls[0]?.[0]).toBeInstanceOf(ApiError);
    expect(cb.onExito).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidar).toHaveBeenCalled());
  });

  it('un 200 con cuerpo ilegible es ContratoError y también vuelve a mirar', async () => {
    registrar(() => HttpResponse.json({ cualquier: 'cosa' }));
    const { result, invalidar } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb);
    });
    await waitFor(() => expect(cb.onFallo).toHaveBeenCalledTimes(1));
    expect(cb.onFallo.mock.calls[0]?.[0]).toBeInstanceOf(ContratoError);
    await waitFor(() => expect(invalidar).toHaveBeenCalled());
  });

  it('un 403 llega como error y no se cuenta como éxito', async () => {
    registrar(() => HttpResponse.json({ message: 'no' }, { status: 403 }));
    const { result } = montar();
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb);
    });
    await waitFor(() => expect(cb.onFallo).toHaveBeenCalledTimes(1));
    expect(cb.onExito).not.toHaveBeenCalled();
  });

  it('si la época cambia antes de la respuesta, no avisa a la pantalla', async () => {
    registrar(async () => {
      await delay(40);
      return HttpResponse.json({ loteId: LOTE, confirmadas: [], omitidas: [] });
    });
    let epoca = 1;
    const { result, rerender } = montar(() => epoca);
    const cb = llamadas();
    act(() => {
      result.current.confirmar([idDe(1)], cb);
    });
    epoca = 2;
    rerender();
    await delay(120);
    expect(cb.onExito).not.toHaveBeenCalled();
    expect(cb.onFallo).not.toHaveBeenCalled();
  });
});
