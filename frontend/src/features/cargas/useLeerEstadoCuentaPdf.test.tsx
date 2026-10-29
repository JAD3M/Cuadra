import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { BANCO_PDF_BBVA } from '@/shared/dominio';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import {
  LECTURA_PDF,
  lecturaPdfFueraDeContrato,
  lecturaPdfRechazada,
  subidaRedDeFallo,
} from '@/test/handlersCargas';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesCargas } from './claves';
import { useLeerEstadoCuentaPdf } from './useLeerEstadoCuentaPdf';

afterEach(() => {
  vi.restoreAllMocks();
});

const pdf = () => new File(['%PDF-1.4'], 'estado-sep-2026.pdf');

function montar(epoca: () => number = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const alExito = vi.fn();
  const alFallar = vi.fn();
  const hook = renderHook(() => useLeerEstadoCuentaPdf(), {
    wrapper: envolturaCargas(cliente, () => sesionConEpoca(epoca())),
  });
  const leer = () =>
    hook.result.current.leer(
      { archivo: pdf(), banco: BANCO_PDF_BBVA },
      { onSuccess: alExito, onError: alFallar },
    );
  return { invalidar, alExito, alFallar, leer, ...hook };
}

describe('useLeerEstadoCuentaPdf', () => {
  it('manda archivo y banco, y entrega los saldos como cadenas exactas', async () => {
    const { leer, alExito } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(alExito).toHaveBeenCalledWith(LECTURA_PDF);
    expect(typeof alExito.mock.calls[0]?.[0].saldoInicial).toBe('string');
    const [subida] = almacenes.cargas.subidas();
    expect(subida?.ruta).toBe('estado-cuenta/pdf');
    expect(subida?.archivos).toEqual([
      expect.objectContaining({
        campo: 'archivo',
        nombre: 'estado-sep-2026.pdf',
      }),
    ]);
    expect(subida?.campos).toEqual([['banco', 'bbva']]);
  });

  it('el PDF que cuadra queda guardado: invalida el historial de su época (historia 3.3)', async () => {
    const { leer, alExito, invalidar } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: clavesCargas.lista(1),
    });
  });

  it('un rechazo no guardó nada: no invalida el historial', async () => {
    servidor.use(lecturaPdfRechazada('sin_movimientos', 'x'));
    const { leer, alFallar, invalidar } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('un doble disparo síncrono envía una sola petición', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    const { leer, result, alExito } = montar();
    let primero = false;
    let segundo = true;
    act(() => {
      primero = leer();
      segundo = leer();
    });
    expect(primero).toBe(true);
    expect(segundo).toBe(false);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    compuerta.abrir();
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(almacenes.cargas.subidas()).toHaveLength(1);
    expect(result.current.isPending).toBe(false);
  });

  it('un 400 con código llega a onError como ApiError con ese código', async () => {
    servidor.use(lecturaPdfRechazada('pdf_sin_texto'));
    const { leer, alFallar, alExito } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    const error = alFallar.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).error).toBe('pdf_sin_texto');
    expect(alExito).not.toHaveBeenCalled();
  });

  it('un corte de red llega como NetworkError', async () => {
    servidor.use(...subidaRedDeFallo());
    const { leer, alFallar } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect(alFallar.mock.calls[0]?.[0]).toBeInstanceOf(NetworkError);
  });

  it('un 200 fuera de contrato (saldo numérico) es ContratoError', async () => {
    servidor.use(lecturaPdfFueraDeContrato());
    const { leer, alFallar, alExito } = montar();
    act(() => {
      leer();
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect(alFallar.mock.calls[0]?.[0]).toBeInstanceOf(ContratoError);
    expect(alExito).not.toHaveBeenCalled();
  });

  it('el resultado de otra época se descarta', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    let epoca = 1;
    const { leer, alExito, alFallar, rerender, result } = montar(() => epoca);
    act(() => {
      leer();
    });
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    epoca = 2;
    rerender();
    compuerta.abrir();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(alExito).not.toHaveBeenCalled();
    expect(alFallar).not.toHaveBeenCalled();
  });
});
