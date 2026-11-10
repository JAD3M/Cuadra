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
import { useReabrirLote } from './useReabrirLote';

const LOTE = idDe(9001);

function registrar(
  respuesta: () => Response | Promise<Response> = () =>
    HttpResponse.json({ loteId: LOTE, reabiertas: [idDe(1)], omitidas: [] }),
) {
  const pedidos: Array<{ ruta: string; cuerpo: string }> = [];
  servidor.use(
    http.post(
      '/api/conciliaciones/lotes/:loteId/reabrir',
      async ({ request }) => {
        pedidos.push({
          ruta: new URL(request.url).pathname,
          cuerpo: await request.text(),
        });
        return respuesta();
      },
    ),
  );
  return pedidos;
}

function montar(epoca = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const hook = renderHook(() => useReabrirLote(), {
    wrapper: envoltura(cliente, () => sesionConEpoca(epoca())),
  });
  return { cliente, invalidar, ...hook };
}

const llamadas = () => ({ onExito: vi.fn(), onFallo: vi.fn() });

describe('useReabrirLote (5.8)', () => {
  it('manda POST a la ruta del lote con el motivo recortado y entrega la respuesta', async () => {
    const pedidos = registrar();
    const { result } = montar();
    const cb = llamadas();
    act(() => {
      result.current.reabrir(LOTE, '  confirmé el lote equivocado  ', cb);
    });
    await waitFor(() => expect(cb.onExito).toHaveBeenCalledTimes(1));
    expect(pedidos).toEqual([
      {
        ruta: `/api/conciliaciones/lotes/${LOTE}/reabrir`,
        cuerpo: JSON.stringify({ motivo: 'confirmé el lote equivocado' }),
      },
    ]);
    expect(cb.onExito).toHaveBeenCalledWith({
      loteId: LOTE,
      reabiertas: [idDe(1)],
      omitidas: [],
    });
    expect(cb.onFallo).not.toHaveBeenCalled();
  });

  it('con el motivo vacío no envía nada', () => {
    const pedidos = registrar();
    const { result } = montar();
    let envio = true;
    act(() => {
      envio = result.current.reabrir(LOTE, '   ', llamadas());
    });
    expect(envio).toBe(false);
    expect(pedidos).toEqual([]);
  });

  it('la guarda evita un segundo envío mientras el primero está en vuelo', async () => {
    const pedidos = registrar(async () => {
      await delay(50);
      return HttpResponse.json({ loteId: LOTE, reabiertas: [], omitidas: [] });
    });
    const { result } = montar();
    const cb = llamadas();
    let primero = false;
    let segundo = true;
    act(() => {
      primero = result.current.reabrir(LOTE, 'motivo', cb);
      segundo = result.current.reabrir(LOTE, 'motivo', cb);
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
      result.current.reabrir(LOTE, 'motivo', cb);
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

  it('un 409 llega como ApiError y no se cuenta como éxito', async () => {
    registrar(() => HttpResponse.json({ message: 'x' }, { status: 409 }));
    const { result } = montar();
    const cb = llamadas();
    act(() => {
      result.current.reabrir(LOTE, 'motivo', cb);
    });
    await waitFor(() => expect(cb.onFallo).toHaveBeenCalledTimes(1));
    const error = cb.onFallo.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(409);
    expect(cb.onExito).not.toHaveBeenCalled();
  });

  it('un 200 con cuerpo ilegible es ContratoError y también vuelve a mirar', async () => {
    registrar(() => HttpResponse.json({ cualquier: 'cosa' }));
    const { result, invalidar } = montar();
    const cb = llamadas();
    act(() => {
      result.current.reabrir(LOTE, 'motivo', cb);
    });
    await waitFor(() => expect(cb.onFallo).toHaveBeenCalledTimes(1));
    expect(cb.onFallo.mock.calls[0]?.[0]).toBeInstanceOf(ContratoError);
    await waitFor(() => expect(invalidar).toHaveBeenCalled());
  });

  it('si la época cambia antes de la respuesta, no avisa a la pantalla', async () => {
    registrar(async () => {
      await delay(40);
      return HttpResponse.json({ loteId: LOTE, reabiertas: [], omitidas: [] });
    });
    let epoca = 1;
    const { result, rerender } = montar(() => epoca);
    const cb = llamadas();
    act(() => {
      result.current.reabrir(LOTE, 'motivo', cb);
    });
    epoca = 2;
    rerender();
    await delay(120);
    expect(cb.onExito).not.toHaveBeenCalled();
    expect(cb.onFallo).not.toHaveBeenCalled();
  });
});
