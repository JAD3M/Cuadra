import { act, renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ContratoError, NetworkError, api } from '@/shared/api';
import { respuestaListaCargas } from '@/shared/api/contratos';
import { TIPO_CFDI, TIPO_ESTADO_CUENTA } from '@/shared/dominio';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import {
  subida413Html,
  subidaFalla,
  subidaFueraDeContrato,
  subidaRedDeFallo,
} from '@/test/handlersCargas';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesCargas } from './claves';
import { useSubirCarga, type PeticionSubida } from './useSubirCarga';

afterEach(() => {
  vi.restoreAllMocks();
});

const xml = (nombre = 'a.xml') => new File(['<x/>'], nombre);
const cfdi = (...nombres: string[]): PeticionSubida => ({
  tipo: TIPO_CFDI,
  archivos: (nombres.length > 0 ? nombres : ['a.xml']).map(xml),
});
const csv: PeticionSubida = {
  tipo: TIPO_ESTADO_CUENTA,
  archivo: new File(['a,b'], 'movs.csv'),
  banco: 'BBVA',
  cuenta: '****1234',
  perfil: 'banco-norte',
};

function montar(epoca: () => number = () => 1) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const alExito = vi.fn();
  const alFallar = vi.fn();
  const hook = renderHook(
    () => {
      const subida = useSubirCarga();
      // Un observador activo de la lista para que la invalidación la pida.
      const lista = useQuery({
        queryKey: clavesCargas.lista(1),
        queryFn: ({ signal }) =>
          api.fetch('/cargas', { schema: respuestaListaCargas, signal }),
      });
      return { subida, lista };
    },
    { wrapper: envolturaCargas(cliente, () => sesionConEpoca(epoca())) },
  );
  const subir = (peticion: PeticionSubida) =>
    hook.result.current.subida.subir(peticion, {
      onSuccess: alExito,
      onError: alFallar,
    });
  return { cliente, invalidar, alExito, alFallar, subir, ...hook };
}

describe('useSubirCarga', () => {
  it('un doble disparo síncrono envía una sola petición', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    const { subir, result, alExito } = montar();
    let primero = false;
    let segundo = true;
    act(() => {
      primero = subir(cfdi());
      segundo = subir(cfdi());
    });
    expect(primero).toBe(true);
    expect(segundo).toBe(false);
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    compuerta.abrir();
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(almacenes.cargas.subidas()).toHaveLength(1);
    expect(result.current.subida.isPending).toBe(false);
  });

  it('202 de un lote nuevo: pendiente, sin yaExistia, y la lista se invalida', async () => {
    const { subir, alExito, invalidar, result } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    act(() => {
      subir(cfdi('a.xml', 'b.xml'));
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    expect(alExito.mock.calls[0]?.[0]).toMatchObject({
      estado: 'pendiente',
      yaExistia: false,
    });
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: clavesCargas.lista(1),
    });
    const [recibida] = almacenes.cargas.subidas();
    expect(recibida?.ruta).toBe('cfdi');
    expect(recibida?.archivos.map((a) => a.campo)).toEqual([
      'archivos',
      'archivos',
    ]);
  });

  it('200 del mismo lote: yaExistia, y vuelve a poder subir tras terminar', async () => {
    const { subir, alExito, result } = montar();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.subida.isPending).toBe(false));
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(2));
    expect(alExito.mock.calls[1]?.[0]).toMatchObject({ yaExistia: true });
  });

  it('el estado de cuenta manda archivo, banco, cuenta y perfil por su ruta', async () => {
    const { subir, alExito } = montar();
    act(() => {
      subir(csv);
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    const [recibida] = almacenes.cargas.subidas();
    expect(recibida?.ruta).toBe('estado-cuenta');
    expect(recibida?.archivos.map((a) => a.campo)).toEqual(['archivo']);
    expect(recibida?.campos).toEqual([
      ['banco', 'BBVA'],
      ['cuenta', '****1234'],
      ['perfil', 'banco-norte'],
    ]);
  });

  it('si la época cambia en vuelo no invalida nada ni avisa al panel', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    let epoca = 1;
    const { subir, rerender, alExito, alFallar, invalidar, result } = montar(
      () => epoca,
    );
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    invalidar.mockClear();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    epoca = 2;
    rerender();
    compuerta.abrir();
    await waitFor(() => expect(result.current.subida.isPending).toBe(false));
    expect(alExito).not.toHaveBeenCalled();
    expect(alFallar).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('un 2xx con cuerpo ilegible es ContratoError e invalida la lista', async () => {
    servidor.use(...subidaFueraDeContrato());
    const { subir, alFallar, invalidar, result } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    invalidar.mockClear();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect(alFallar.mock.calls[0]?.[0]).toBeInstanceOf(ContratoError);
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: clavesCargas.lista(1),
    });
  });

  it.each([400, 403, 500])(
    'un %i llega a onError con su estado y no invalida la lista',
    async (status) => {
      servidor.use(...subidaFalla(status, 'motivo del servidor'));
      const { subir, alFallar, invalidar, result } = montar();
      await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
      invalidar.mockClear();
      act(() => {
        subir(cfdi());
      });
      await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
      const error = alFallar.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(status);
      expect(invalidar).not.toHaveBeenCalled();
    },
  );

  it('un 413 con cuerpo HTML llega con su estado', async () => {
    servidor.use(...subida413Html());
    const { subir, alFallar } = montar();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect((alFallar.mock.calls[0]?.[0] as ApiError).statusCode).toBe(413);
  });

  it('un fallo de red llega como NetworkError', async () => {
    servidor.use(...subidaRedDeFallo());
    const { subir, alFallar } = montar();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    expect(alFallar.mock.calls[0]?.[0]).toBeInstanceOf(NetworkError);
  });

  it('tras un fallo la guarda se libera y se puede reintentar', async () => {
    servidor.use(...subidaFalla(500));
    const { subir, alFallar, result } = montar();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.subida.isPending).toBe(false));
    let again = false;
    act(() => {
      again = subir(cfdi());
    });
    expect(again).toBe(true);
    await waitFor(() => expect(alFallar).toHaveBeenCalledTimes(2));
  });

  it('la invalidación no se espera: la mutación termina antes que una lista lenta', async () => {
    const { subir, alExito, result } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const lenta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: lenta.promesa });
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(alExito).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.subida.isSuccess).toBe(true));
    expect(result.current.lista.isFetching).toBe(true);
    lenta.abrir();
    await waitFor(() => expect(result.current.lista.isFetching).toBe(false));
  });

  it('subir() devuelve false si la sesión no está lista y no envía nada', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useSubirCarga(), {
      wrapper: envolturaCargas(cliente, () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    let enviado = true;
    act(() => {
      enviado = result.current.subir(cfdi());
    });
    expect(enviado).toBe(false);
    await esperarIntervalos();
    expect(result.current.isPending).toBe(false);
    expect(almacenes.cargas.subidas()).toHaveLength(0);
  });

  it('tras desmontar no se llama a nada de la pantalla', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    const { subir, unmount, alExito, cliente } = montar();
    act(() => {
      subir(cfdi());
    });
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    unmount();
    compuerta.abrir();
    // Control positivo: la mutación SÍ terminó (el servidor respondió y el
    // cliente la procesó); aun así la pantalla desmontada no se enteró.
    await waitFor(() =>
      expect(cliente.getMutationCache().getAll()[0]?.state.status).toBe(
        'success',
      ),
    );
    await esperarIntervalos();
    expect(alExito).not.toHaveBeenCalled();
  });
});
