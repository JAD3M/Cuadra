import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ContratoError } from '@/shared/api';
import { casoSugerencia } from '@/test/fixturesCaso';
import { idDe } from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { casoFalla } from '@/test/handlersCaso';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { clavesCaso } from './claves';
import { useCaso } from './useCaso';

describe('useCaso', () => {
  it('pide /casos/{id} codificado y entrega el caso validado', async () => {
    const espia = espiarSolicitudes();
    const caso = casoSugerencia();
    servidor.use(http.get('/api/casos/:id', () => HttpResponse.json(caso)));
    const { result } = renderHook(() => useCaso(caso.movimiento.id), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    espia.detener();
    expect(result.current.data?.movimiento.id).toBe(caso.movimiento.id);
    expect(espia.cuantas('GET', `/api/casos/${caso.movimiento.id}`)).toBe(1);
  });

  it('codifica el id en la ruta', async () => {
    const rutas: string[] = [];
    servidor.use(
      http.get('/api/casos/*', ({ request }) => {
        rutas.push(new URL(request.url).pathname);
        return HttpResponse.json({}, { status: 404 });
      }),
    );
    const { result } = renderHook(() => useCaso('a/b?c'), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(rutas).toEqual(['/api/casos/a%2Fb%3Fc']);
  });

  it('un cuerpo fuera del contrato es ContratoError', async () => {
    servidor.use(
      http.get('/api/casos/:id', () =>
        HttpResponse.json({
          ...casoSugerencia(),
          toleranciaMonto: 0.5,
        }),
      ),
    );
    const { result } = renderHook(() => useCaso(idDe(1)), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(result.current.data).toBeUndefined();
  });

  it('expone el status HTTP del fallo sin reintentar un 4xx', async () => {
    servidor.use(casoFalla(404));
    const { result } = renderHook(() => useCaso(idDe(1)), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('está deshabilitado sin época y no envía nada', async () => {
    const espia = espiarSolicitudes();
    const { result } = renderHook(() => useCaso(idDe(1)), {
      wrapper: envoltura(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await new Promise((r) => setTimeout(r, 30));
    espia.detener();
    expect(result.current.fetchStatus).toBe('idle');
    expect(espia.solicitudes).toHaveLength(0);
  });

  it('no usa datos provisionales de otro caso al cambiar de id', async () => {
    const a = casoSugerencia();
    const b = casoSugerencia({
      movimiento: { ...a.movimiento, id: idDe(2), descripcion: 'otro' },
    });
    servidor.use(
      http.get('/api/casos/:id', ({ params }) =>
        HttpResponse.json(params.id === a.movimiento.id ? a : b),
      ),
    );
    let id = a.movimiento.id;
    const { result, rerender } = renderHook(() => useCaso(id), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    id = b.movimiento.id;
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.data?.movimiento.id).toBe(b.movimiento.id),
    );
  });

  it('aísla las épocas: la clave de otra época no se sirve', async () => {
    const cliente = clienteDePruebas();
    const caso = casoSugerencia();
    servidor.use(http.get('/api/casos/:id', () => HttpResponse.json(caso)));
    let epoca = 1;
    const { result, rerender } = renderHook(() => useCaso(caso.movimiento.id), {
      wrapper: envoltura(cliente, () => sesionConEpoca(epoca)),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    epoca = 2;
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      cliente.getQueryData(clavesCaso.detalle(1, caso.movimiento.id)),
    ).toBeDefined();
    expect(
      cliente.getQueryData(clavesCaso.detalle(2, caso.movimiento.id)),
    ).toBeDefined();
  });
});
