import { renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ContratoError } from '@/shared/api';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { filaBandeja } from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { rutaBandeja, useBandeja } from './useBandeja';

/** Registra la URL completa (con query) de cada `GET /bandeja`. */
function urlsDeLista() {
  const urls: string[] = [];
  servidor.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/bandeja') urls.push(url.search);
  });
  return urls;
}

const POR_DEFECTO: EstadoBandeja[] = ['sugerencia', 'sin_match'];

describe('rutaBandeja', () => {
  it('manda cada estado repetido, la página y el límite fijo', () => {
    expect(rutaBandeja(['sugerencia', 'sin_match'], 3)).toBe(
      '/bandeja?estado=sugerencia&estado=sin_match&pagina=3&limite=20',
    );
  });
});

describe('useBandeja', () => {
  it('pide estados explícitos en orden canónico, con página y límite 20', async () => {
    const urls = urlsDeLista();
    const cliente = clienteDePruebas();
    const { result } = renderHook(
      () => useBandeja({ estados: ['sin_match', 'conciliado'], pagina: 2 }),
      { wrapper: envoltura(cliente) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    servidor.events.removeAllListeners();
    expect(urls).toEqual([
      '?estado=conciliado&estado=sin_match&pagina=2&limite=20',
    ]);
  });

  it('nunca omite el estado: sin ninguno manda los de por defecto', async () => {
    const urls = urlsDeLista();
    const { result } = renderHook(
      () => useBandeja({ estados: [], pagina: 1 }),
      { wrapper: envoltura(clienteDePruebas()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    servidor.events.removeAllListeners();
    expect(urls).toEqual([
      '?estado=sugerencia&estado=sin_match&pagina=1&limite=20',
    ]);
  });

  it('entrega la respuesta validada por el contrato', async () => {
    const { result } = renderHook(
      () => useBandeja({ estados: POR_DEFECTO, pagina: 1 }),
      { wrapper: envoltura(clienteDePruebas()) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      pagina: 1,
      limite: 20,
      total: 39,
    });
    expect(result.current.data?.datos).toHaveLength(20);
  });

  it('un cuerpo fuera del contrato es ContratoError y no se usa como dato', async () => {
    servidor.use(
      http.get('/api/bandeja', () =>
        HttpResponse.json({
          datos: [{ ...filaBandeja(), monto: 1160 }],
          pagina: 1,
          limite: 20,
          total: 1,
        }),
      ),
    );
    const { result } = renderHook(
      () => useBandeja({ estados: POR_DEFECTO, pagina: 1 }),
      { wrapper: envoltura(clienteDePruebas()) },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(result.current.data).toBeUndefined();
  });

  it('está deshabilitado mientras la sesión no está lista', async () => {
    const espia = espiarSolicitudes();
    const { result } = renderHook(
      () => useBandeja({ estados: POR_DEFECTO, pagina: 1 }),
      {
        wrapper: envoltura(clienteDePruebas(), () => ({
          status: 'loading',
          restaurarOrigen: false,
        })),
      },
    );
    await new Promise((r) => setTimeout(r, 30));
    espia.detener();
    expect(result.current.fetchStatus).toBe('idle');
    expect(espia.cuantas('GET', '/api/bandeja')).toBe(0);
  });

  it('conserva las filas anteriores mientras carga la página siguiente', async () => {
    const { result, rerender } = renderHook(
      ({ pagina }) => useBandeja({ estados: POR_DEFECTO, pagina }),
      { wrapper: envoltura(clienteDePruebas()), initialProps: { pagina: 1 } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const primera = result.current.data;
    servidor.use(
      http.get('/api/bandeja', async () => {
        await delay(60);
        return HttpResponse.json({
          datos: [],
          pagina: 2,
          limite: 20,
          total: 39,
        });
      }),
    );
    rerender({ pagina: 2 });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(primera);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.pagina).toBe(2);
  });

  it('no reutiliza como provisional lo de otra época', async () => {
    let estado = sesionConEpoca(1);
    const { result, rerender } = renderHook(
      () => useBandeja({ estados: POR_DEFECTO, pagina: 1 }),
      { wrapper: envoltura(clienteDePruebas(), () => estado) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    servidor.use(
      http.get('/api/bandeja', async () => {
        await delay(60);
        return HttpResponse.json({
          datos: [],
          pagina: 1,
          limite: 20,
          total: 0,
        });
      }),
    );
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(0);
  });

  it('lo cargado en la época 1 no se sirve en la época 2 y vuelve al regresar', async () => {
    const cliente = clienteDePruebas();
    let estado = sesionConEpoca(1);
    let llamadas = 0;
    servidor.use(
      http.get('/api/bandeja', () => {
        llamadas += 1;
        return HttpResponse.json({
          datos: [],
          pagina: 1,
          limite: 20,
          total: llamadas,
        });
      }),
    );
    const { result, rerender } = renderHook(
      () => useBandeja({ estados: POR_DEFECTO, pagina: 1 }),
      { wrapper: envoltura(cliente, () => estado) },
    );
    await waitFor(() => expect(result.current.data?.total).toBe(1));
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.total).toBe(2));
    expect(llamadas).toBe(2);
  });
});
