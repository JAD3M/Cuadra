import { renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ContratoError } from '@/shared/api';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { resumenFalla } from '@/test/fixturesBandeja';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { useResumenBandeja, usePendientesBandeja } from './useResumenBandeja';

function resumenCon(sugerencia: number, sin_match: number) {
  return http.get('/api/bandeja/resumen', () =>
    HttpResponse.json({
      conteos: { conciliado: 4, sugerencia, sin_match },
      montoPorRevisar: [],
    }),
  );
}

describe('useResumenBandeja', () => {
  it('entrega conteos y monto por revisar validados', async () => {
    const { result } = renderHook(() => useResumenBandeja(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.conteos).toEqual({
      conciliado: 4,
      sugerencia: 26,
      sin_match: 13,
    });
    expect(result.current.data?.montoPorRevisar.map((m) => m.moneda)).toEqual([
      'MXN',
      'USD',
    ]);
  });

  it('un cuerpo fuera del contrato es ContratoError', async () => {
    servidor.use(
      http.get('/api/bandeja/resumen', () =>
        HttpResponse.json({ conteos: { conciliado: 1 }, montoPorRevisar: [] }),
      ),
    );
    const { result } = renderHook(() => useResumenBandeja(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
  });

  it('dos observadores producen una sola petición', async () => {
    const espia = espiarSolicitudes();
    const cliente = clienteDePruebas();
    const { result } = renderHook(
      () => ({ a: useResumenBandeja(), b: usePendientesBandeja() }),
      { wrapper: envoltura(cliente) },
    );
    await waitFor(() => expect(result.current.a.isSuccess).toBe(true));
    espia.detener();
    expect(result.current.b).toBe(39);
    expect(espia.cuantas('GET', '/api/bandeja/resumen')).toBe(1);
  });

  it('un observador que se monta después reutiliza lo vigente', async () => {
    const espia = espiarSolicitudes();
    const cliente = clienteDePruebas();
    const primero = renderHook(() => useResumenBandeja(), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));
    const segundo = renderHook(() => useResumenBandeja(), {
      wrapper: envoltura(cliente),
    });
    expect(segundo.result.current.data).toBeDefined();
    await new Promise((r) => setTimeout(r, 30));
    espia.detener();
    expect(espia.cuantas('GET', '/api/bandeja/resumen')).toBe(1);
  });

  it('está deshabilitado sin sesión lista y no cruza épocas', async () => {
    let estado = sesionConEpoca(1);
    let llamadas = 0;
    servidor.use(
      http.get('/api/bandeja/resumen', async () => {
        llamadas += 1;
        await delay(40);
        return HttpResponse.json({
          conteos: { conciliado: 0, sugerencia: llamadas, sin_match: 0 },
          montoPorRevisar: [],
        });
      }),
    );
    const { result, rerender } = renderHook(() => useResumenBandeja(), {
      wrapper: envoltura(clienteDePruebas(), () => estado),
    });
    await waitFor(() =>
      expect(result.current.data?.conteos.sugerencia).toBe(1),
    );
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.data?.conteos.sugerencia).toBe(2),
    );
  });
});

describe('usePendientesBandeja', () => {
  it('suma sugerencia y sin_match', async () => {
    servidor.use(resumenCon(26, 13));
    const { result } = renderHook(() => usePendientesBandeja(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current).toBe(39));
  });

  it('es undefined mientras carga', () => {
    servidor.use(http.get('/api/bandeja/resumen', () => delay('infinite')));
    const { result } = renderHook(() => usePendientesBandeja(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    expect(result.current).toBeUndefined();
  });

  it('es undefined si la consulta falla', async () => {
    servidor.use(resumenFalla(500));
    const cliente = clienteDePruebas();
    const { result } = renderHook(
      () => ({ p: usePendientesBandeja(), r: useResumenBandeja() }),
      { wrapper: envoltura(cliente) },
    );
    await waitFor(() => expect(result.current.r.isError).toBe(true));
    expect(result.current.p).toBeUndefined();
  });

  it('es undefined cuando no hay pendientes (suma 0)', async () => {
    servidor.use(resumenCon(0, 0));
    const { result } = renderHook(
      () => ({ p: usePendientesBandeja(), r: useResumenBandeja() }),
      { wrapper: envoltura(clienteDePruebas()) },
    );
    await waitFor(() => expect(result.current.r.isSuccess).toBe(true));
    expect(result.current.p).toBeUndefined();
  });

  it('con solo sin_match o solo sugerencia sí muestra el conteo', async () => {
    servidor.use(resumenCon(0, 5));
    const { result } = renderHook(() => usePendientesBandeja(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current).toBe(5));
  });

  it('es undefined sin sesión lista', async () => {
    const espia = espiarSolicitudes();
    const { result } = renderHook(() => usePendientesBandeja(), {
      wrapper: envoltura(clienteDePruebas(), () => ({ status: 'unavailable' })),
    });
    await new Promise((r) => setTimeout(r, 30));
    espia.detener();
    expect(result.current).toBeUndefined();
    expect(espia.cuantas('GET', '/api/bandeja/resumen')).toBe(0);
  });
});
