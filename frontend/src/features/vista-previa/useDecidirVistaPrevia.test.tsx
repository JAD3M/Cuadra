import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api';
import { clavesBandeja } from '@/features/bandeja/claves';
import { clavesCargas } from '@/features/cargas/claves';
import { crearCompuerta } from '@/test/compuerta';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { http, HttpResponse } from 'msw';
import {
  ID_CARGA,
  RUTA_ACEPTAR,
  aceptarFalla,
  aceptarResponde,
  rechazarResponde,
} from './pruebas';
import { useDecidirVistaPrevia } from './useDecidirVistaPrevia';

afterEach(() => {
  vi.restoreAllMocks();
});

function montar(epoca: () => number = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const alExito = vi.fn();
  const alFallar = vi.fn();
  const hook = renderHook(() => useDecidirVistaPrevia(), {
    wrapper: envolturaCargas(cliente, () => sesionConEpoca(epoca())),
  });
  const decidir = (accion: 'aceptar' | 'rechazar') =>
    hook.result.current.decidir(
      { accion, cargaId: ID_CARGA },
      { onSuccess: alExito, onError: alFallar },
    );
  return { invalidar, alExito, alFallar, decidir, ...hook };
}

describe('useDecidirVistaPrevia', () => {
  it('aceptar: POST /aceptar, devuelve los movimientos e invalida historial, detalle y bandeja', async () => {
    servidor.use(aceptarResponde(14));
    const { decidir, alExito, invalidar } = montar();
    act(() => {
      decidir('aceptar');
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(alExito.mock.calls[0]?.[0]).toMatchObject({
      estado: 'procesada',
      movimientos: 14,
    });
    const claves = invalidar.mock.calls.map((c) => c[0]?.queryKey);
    expect(claves).toContainEqual(clavesCargas.lista(1));
    expect(claves).toContainEqual(clavesCargas.detalle(1, ID_CARGA));
    expect(claves).toContainEqual(clavesBandeja.todas(1));
  });

  it('rechazar: POST /rechazar, invalida el historial y no toca la bandeja', async () => {
    servidor.use(rechazarResponde());
    const { decidir, alExito, invalidar } = montar();
    act(() => {
      decidir('rechazar');
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(alExito.mock.calls[0]?.[0]).toMatchObject({ estado: 'rechazada' });
    const claves = invalidar.mock.calls.map((c) => c[0]?.queryKey);
    expect(claves).toContainEqual(clavesCargas.lista(1));
    expect(claves).not.toContainEqual(clavesBandeja.todas(1));
  });

  it('no invalida la vista previa misma: ya no existe tras decidir', async () => {
    servidor.use(aceptarResponde());
    const { decidir, alExito, invalidar } = montar();
    act(() => {
      decidir('aceptar');
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    const claves = invalidar.mock.calls.map((c) => c[0]?.queryKey);
    expect(claves).not.toContainEqual(clavesCargas.todas(1));
    expect(claves).not.toContainEqual(clavesCargas.vistaPrevia(1, ID_CARGA));
  });

  it('un 409 llega a onError como ApiError y no invalida nada', async () => {
    servidor.use(aceptarFalla(409));
    const { decidir, alFallar, alExito, invalidar } = montar();
    act(() => {
      decidir('aceptar');
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    const error = alFallar.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(409);
    expect(alExito).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('un doble disparo síncrono envía una sola petición', async () => {
    const compuerta = crearCompuerta();
    let peticiones = 0;
    servidor.use(
      http.post(RUTA_ACEPTAR, async ({ params }) => {
        peticiones += 1;
        await compuerta.promesa;
        return HttpResponse.json({
          cargaId: String(params.id),
          estado: 'procesada',
          movimientos: 3,
        });
      }),
    );
    const { decidir, alExito } = montar();
    let primero = false;
    let segundo = true;
    act(() => {
      primero = decidir('aceptar');
      segundo = decidir('rechazar');
    });
    expect(primero).toBe(true);
    expect(segundo).toBe(false);
    compuerta.abrir();
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(peticiones).toBe(1);
  });

  it('el resultado de otra época se descarta', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      http.post(RUTA_ACEPTAR, async ({ params }) => {
        await compuerta.promesa;
        return HttpResponse.json({
          cargaId: String(params.id),
          estado: 'procesada',
          movimientos: 3,
        });
      }),
    );
    let epoca = 1;
    const { decidir, alExito, invalidar, rerender, result } = montar(
      () => epoca,
    );
    act(() => {
      decidir('aceptar');
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    epoca = 2;
    rerender();
    compuerta.abrir();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(alExito).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
  });
});
