import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { almacenes } from '@/test/handlers';
import { valorFalla } from '@/test/handlersTolerancia';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { http, HttpResponse } from 'msw';
import { clavesTolerancia } from './claves';
import { useTolerancia } from './useTolerancia';

const tolerancia = almacenes.tolerancia;

describe('useTolerancia', () => {
  it('pide GET /empresa/tolerancia y deja el valor en la clave de su época', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ toleranciaMonto: '0.5000' });
    expect(cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
      toleranciaMonto: '0.5000',
    });
    expect(tolerancia.peticiones()).toEqual([
      {
        metodo: 'GET',
        ruta: '/api/empresa/tolerancia',
        consulta: {},
        cuerpo: null,
      },
    ]);
  });

  it('entrega el valor tal como llega, sin tocar los decimales', async () => {
    tolerancia.establecer('0.0050');
    const { result } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.toleranciaMonto).toBe('0.0050');
  });

  it('otra época usa otra clave y vuelve a pedir', async () => {
    const cliente = clienteDePruebas();
    let epoca = 1;
    const { result, rerender } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(cliente, () => sesionConEpoca(epoca)),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    tolerancia.establecer('2.0000');
    epoca = 2;
    rerender();
    await waitFor(() =>
      expect(cliente.getQueryData(clavesTolerancia.valor(2))).toEqual({
        toleranciaMonto: '2.0000',
      }),
    );
    expect(cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
      toleranciaMonto: '0.5000',
    });
    expect(
      tolerancia.peticiones().filter((p) => p.metodo === 'GET'),
    ).toHaveLength(2);
  });

  it('sin sesión lista no pide nada', async () => {
    const { result } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperarIntervalos();
    expect(result.current.fetchStatus).toBe('idle');
    expect(tolerancia.peticiones()).toHaveLength(0);
  });

  it('un 500 deja el error del servidor y data indefinido', async () => {
    servidor.use(valorFalla(500));
    const { result } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).statusCode).toBe(500);
    expect(result.current.data).toBeUndefined();
  });

  it('un 2xx con el valor como número es ContratoError', async () => {
    servidor.use(
      http.get('/api/empresa/tolerancia', () =>
        HttpResponse.json({ toleranciaMonto: 0.5 }),
      ),
    );
    const { result } = renderHook(() => useTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(result.current.data).toBeUndefined();
  });
});
