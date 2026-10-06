import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ContratoError } from '@/shared/api';
import { idDe } from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { useHistorial } from './useHistorial';

const EVENTOS = {
  datos: [
    {
      id: 'e1',
      accion: 'crear',
      createdAt: '2026-09-16T09:14:00.000Z',
      usuario: null,
    },
  ],
};

describe('useHistorial', () => {
  it('pide el historial de la conciliación y lo valida', async () => {
    const espia = espiarSolicitudes();
    servidor.use(
      http.get('/api/conciliaciones/:id/historial', () =>
        HttpResponse.json(EVENTOS),
      ),
    );
    const { result } = renderHook(() => useHistorial(idDe(5001)), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    espia.detener();
    expect(result.current.data?.datos).toHaveLength(1);
    expect(
      espia.cuantas('GET', `/api/conciliaciones/${idDe(5001)}/historial`),
    ).toBe(1);
  });

  it('está deshabilitado con un id nulo: no pide nada', async () => {
    const espia = espiarSolicitudes();
    const { result } = renderHook(() => useHistorial(null), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await new Promise((r) => setTimeout(r, 30));
    espia.detener();
    expect(result.current.fetchStatus).toBe('idle');
    expect(espia.solicitudes).toHaveLength(0);
  });

  it('vuelve a pedir cuando cambia el id', async () => {
    const pedidos: string[] = [];
    servidor.use(
      http.get('/api/conciliaciones/:id/historial', ({ params }) => {
        pedidos.push(String(params.id));
        return HttpResponse.json(EVENTOS);
      }),
    );
    let id: string | null = idDe(5001);
    const { result, rerender } = renderHook(() => useHistorial(id), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    id = idDe(5002);
    rerender();
    await waitFor(() => expect(pedidos).toEqual([idDe(5001), idDe(5002)]));
  });

  it('un cuerpo inválido es ContratoError', async () => {
    servidor.use(
      http.get('/api/conciliaciones/:id/historial', () =>
        HttpResponse.json({ datos: [{ id: 'x' }] }),
      ),
    );
    const { result } = renderHook(() => useHistorial(idDe(5001)), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
  });
});
