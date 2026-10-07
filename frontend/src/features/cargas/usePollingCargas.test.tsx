import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import {
  detalleCarga,
  itemCarga,
  respuestaNueva,
  respuestaYaExistia,
} from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { listaFalla } from '@/test/handlersCargas';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import {
  POLLING_RAPIDO,
  envolturaCargas,
  esperarIntervalos,
  intervaloDe,
} from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesCargas } from './claves';
import { usePollingCargas, type PanelSubida } from './usePollingCargas';

afterEach(() => {
  focusManager.setFocused(undefined);
});

const PENDIENTE = itemCarga(1, { estado: 'pendiente' });
const ID_PANEL = detalleCarga(50).id;

function panelDe(inicial = respuestaNueva(50), epoca = 1): PanelSubida {
  return {
    id: inicial.id,
    tipo: 'cfdi',
    yaExistia: inicial.yaExistia,
    inicial,
    epoca,
  };
}

function montar(
  opciones: {
    panel?: PanelSubida | null;
    polling?: Parameters<typeof envolturaCargas>[2];
    epoca?: () => number;
    cliente?: QueryClient;
  } = {},
) {
  const cliente = opciones.cliente ?? clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const epoca = opciones.epoca ?? (() => 1);
  const hook = renderHook(() => usePollingCargas(opciones.panel ?? null), {
    wrapper: envolturaCargas(
      cliente,
      () => sesionConEpoca(epoca()),
      opciones.polling,
    ),
  });
  return { cliente, invalidar, ...hook };
}

describe('usePollingCargas: la lista', () => {
  it('pide la lista y la entrega validada con la clave de su época', async () => {
    const { result, cliente } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(result.current.lista.data?.datos).toHaveLength(20);
    expect(cliente.getQueryData(clavesCargas.lista(1))).toBeDefined();
  });

  it('vuelve a pedir solo mientras una fila está pendiente o procesando', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result } = montar({ polling: POLLING_RAPIDO });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(3),
    );
    expect(result.current.lista.data?.datos[0]?.estado).toBe('pendiente');
    espia.detener();
  });

  it('se detiene sin pedir de más cuando todas quedan terminadas', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result, cliente } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    // Control positivo: el polling está vivo mientras la fila está activa.
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(2),
    );
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(15);
    almacenes.cargas.avanzar(PENDIENTE.id, 'procesada', { registrosOk: 3 });
    await waitFor(() =>
      expect(result.current.lista.data?.datos[0]?.estado).toBe('procesada'),
    );
    await waitFor(() => expect(result.current.lista.isFetching).toBe(false));
    const total = espia.cuantas('GET', '/api/cargas');
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(false);
    await esperarIntervalos();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(total);
    espia.detener();
  });

  it('con la lista vacía no hay polling', async () => {
    almacenes.cargas.establecer([]);
    const espia = espiarSolicitudes();
    const { result, cliente } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(false);
    await esperarIntervalos();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(1);
    // Control positivo: el mismo montaje SÍ sondea en cuanto hay una fila
    // activa, así que la ausencia anterior no era un polling roto.
    almacenes.cargas.establecer([PENDIENTE]);
    act(() => {
      void result.current.lista.refetch();
    });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(4),
    );
    espia.detener();
  });

  it('con las constantes REALES el intervalo es 3000 o false, sin esperar', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const { result, cliente } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const consulta = cliente.getQueryCache().find({
      queryKey: clavesCargas.lista(1),
    });
    const intervalo = consulta?.observers[0]?.options.refetchInterval;
    expect(typeof intervalo).toBe('function');
    if (typeof intervalo !== 'function' || !consulta) return;
    expect(intervalo(consulta)).toBe(3000);
    cliente.setQueryData(clavesCargas.lista(1), {
      datos: [{ ...PENDIENTE, estado: 'procesada' }],
    });
    expect(intervalo(consulta)).toBe(false);
  });

  it('un sondeo que falla conserva los últimos datos', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const { result } = montar({ polling: POLLING_RAPIDO });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    servidor.use(listaFalla(500));
    await waitFor(() => expect(result.current.lista.isError).toBe(true));
    expect(result.current.lista.data?.datos).toHaveLength(1);
  });

  it('con la pestaña oculta no pide solo y al volver reanuda', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    focusManager.setFocused(false);
    const espia = espiarSolicitudes();
    const { result, cliente } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.lista.isFetching).toBe(false));
    const antes = espia.cuantas('GET', '/api/cargas');
    // El intervalo está armado (hay una fila activa); solo la pestaña oculta
    // impide pedir.
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(15);
    await esperarIntervalos();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(antes);
    act(() => {
      focusManager.setFocused(true);
    });
    // Control positivo: al volver, el MISMO montaje sondea varias veces
    // (más que la sola recarga por foco), así que el intervalo estaba vivo.
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(
        antes + 3,
      ),
    );
    espia.detener();
  });

  it('al desmontar no queda temporizador ni petición', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result, unmount, cliente } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(2),
    );
    expect(result.current.lista.isSuccess).toBe(true);
    unmount();
    const consulta = cliente.getQueryCache().find({
      queryKey: clavesCargas.lista(1),
    });
    expect(consulta?.getObserversCount()).toBe(0);
    await waitFor(() => expect(consulta?.state.fetchStatus).toBe('idle'));
    const total = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(total);
    espia.detener();
  });

  it('cambiar de época con una petición en vuelo no escribe la respuesta vieja', async () => {
    const compuerta = crearCompuerta();
    let llamadas = 0;
    let viejaRespondida = false;
    servidor.use(
      http.get('/api/cargas', async () => {
        llamadas += 1;
        if (llamadas === 1) {
          await compuerta.promesa;
          viejaRespondida = true;
          return HttpResponse.json({ datos: [itemCarga(1)] });
        }
        return HttpResponse.json({ datos: [itemCarga(2), itemCarga(3)] });
      }),
    );
    let epoca = 1;
    const { result, rerender, cliente } = montar({ epoca: () => epoca });
    await waitFor(() => expect(llamadas).toBe(1));
    epoca = 2;
    rerender();
    await waitFor(() =>
      expect(result.current.lista.data?.datos).toHaveLength(2),
    );
    compuerta.abrir();
    // El servidor ya contestó la petición vieja; el testigo da tiempo a que
    // el cliente la procese antes de afirmar que no se escribió.
    await waitFor(() => expect(viejaRespondida).toBe(true));
    await esperarIntervalos();
    // La respuesta de la época vieja no llegó a ninguna clave.
    expect(cliente.getQueryData(clavesCargas.lista(1))).toBeUndefined();
    expect(
      result.current.lista.data?.datos.map((f) => f.nombreArchivo),
    ).toEqual(['lote-2.xml', 'lote-3.xml']);
    expect(
      (
        cliente.getQueryData(clavesCargas.lista(2)) as {
          datos: unknown[];
        }
      ).datos,
    ).toHaveLength(2);
  });
});

describe('usePollingCargas: el tope y Actualizar', () => {
  it('al vencer el tope deja de pedir y avisa; actualizar() reabre la ventana', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result, cliente } = montar({ polling: POLLING_RAPIDO });
    // Control positivo: antes del tope el polling pide varias veces.
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(3),
    );
    await waitFor(() => expect(result.current.capada).toBe(true));
    await waitFor(() => expect(result.current.lista.isFetching).toBe(false));
    const alCapar = espia.cuantas('GET', '/api/cargas');
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(false);
    await esperarIntervalos();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(alCapar);

    const ventana = result.current.ventana;
    act(() => {
      result.current.actualizar();
    });
    expect(result.current.ventana).toBe(ventana + 1);
    expect(result.current.capada).toBe(false);
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(alCapar),
    );
    await waitFor(() => expect(result.current.capada).toBe(true));
    espia.detener();
  });

  it('iniciarVentana() abre otra ventana (subida correcta)', async () => {
    const { result } = montar({ polling: POLLING_RAPIDO });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const ventana = result.current.ventana;
    act(() => {
      result.current.iniciarVentana();
    });
    expect(result.current.ventana).toBe(ventana + 1);
  });
});

describe('usePollingCargas: el panel de la carga subida', () => {
  it('sin carga subida no pide ningún detalle', async () => {
    const espia = espiarSolicitudes();
    const { result } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(result.current.consultaPanel.fetchStatus).toBe('idle');
    expect(
      espia.solicitudes.some((s) => s.ruta.startsWith('/api/cargas/')),
    ).toBe(false);
    espia.detener();
  });

  it('un cuerpo de POST activo se consulta con GET /cargas/:id y avanza', async () => {
    almacenes.cargas.establecerDetalle(detalleCarga(50));
    const { result } = montar({
      panel: panelDe(),
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() =>
      expect(result.current.consultaPanel.data?.id).toBe(ID_PANEL),
    );
    expect(result.current.panelDatos?.estado).toBe('pendiente');
    almacenes.cargas.establecerDetalle(
      detalleCarga(50, { estado: 'procesada' }),
    );
    await waitFor(() =>
      expect(result.current.panelDatos?.estado).toBe('procesada'),
    );
  });

  it('un yaExistia terminado NO pide GET /cargas/:id y se muestra del POST', async () => {
    const espia = espiarSolicitudes();
    const inicial = respuestaYaExistia('procesada', 50);
    const { result } = montar({
      panel: panelDe(inicial),
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(1);
    await esperarIntervalos();
    expect(result.current.consultaPanel.fetchStatus).toBe('idle');
    expect(result.current.panelDatos).toBe(inicial);
    expect(espia.cuantas('GET', `/api/cargas/${inicial.id}`)).toBe(0);
    espia.detener();
  });

  it('el panel de otra época no se consulta ni se entrega', async () => {
    const espia = espiarSolicitudes();
    const { result } = montar({
      panel: panelDe(respuestaNueva(50), 7),
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(1);
    await esperarIntervalos();
    expect(result.current.panelDatos).toBeNull();
    expect(espia.cuantas('GET', `/api/cargas/${ID_PANEL}`)).toBe(0);
    espia.detener();
  });

  it('panel y lista comparten una sola ventana y un solo tope', async () => {
    almacenes.cargas.establecerDetalle(detalleCarga(50));
    almacenes.cargas.establecer([PENDIENTE]);
    const { result } = montar({ panel: panelDe(), polling: POLLING_RAPIDO });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(result.current.ventana).toBe(1);
    await waitFor(() => expect(result.current.capada).toBe(true));
    expect(result.current.ventana).toBe(1);
  });
});

describe('usePollingCargas: la bandeja se entera de lo que termina (M17)', () => {
  it('una fila de la lista que pasa de activa a terminada invalida lista y bandeja de su época', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const { result, invalidar } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    almacenes.cargas.avanzar(PENDIENTE.id, 'procesada', { registrosOk: 3 });
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['bandeja', 1] }),
    );
  });

  it('la carga del panel que termina invalida la lista y la bandeja', async () => {
    almacenes.cargas.establecerDetalle(detalleCarga(50));
    const { result, invalidar } = montar({
      panel: panelDe(),
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() =>
      expect(result.current.consultaPanel.data?.id).toBe(ID_PANEL),
    );
    expect(invalidar).not.toHaveBeenCalled();
    almacenes.cargas.establecerDetalle(
      detalleCarga(50, { estado: 'procesada' }),
    );
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith({
        queryKey: clavesCargas.lista(1),
      }),
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['bandeja', 1] });
  });

  it('la lista y el panel ven terminar la misma carga y la bandeja se invalida una sola vez', async () => {
    almacenes.cargas.establecerDetalle(detalleCarga(50));
    almacenes.cargas.establecer([itemCarga(50, { estado: 'pendiente' })]);
    const { result, invalidar } = montar({
      panel: panelDe(),
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() =>
      expect(result.current.consultaPanel.data?.id).toBe(ID_PANEL),
    );
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    almacenes.cargas.establecerDetalle(
      detalleCarga(50, { estado: 'procesada' }),
    );
    almacenes.cargas.avanzar(ID_PANEL, 'procesada', { registrosOk: 1 });
    // Control positivo: ambos observadores terminaron de ver el cambio.
    await waitFor(() => {
      expect(result.current.consultaPanel.data?.estado).toBe('procesada');
      expect(result.current.lista.data?.datos[0]?.estado).toBe('procesada');
    });
    await esperarIntervalos();
    const deBandeja = invalidar.mock.calls.filter(
      ([filtros]) =>
        JSON.stringify(filtros?.queryKey) === JSON.stringify(['bandeja', 1]),
    );
    expect(deBandeja).toHaveLength(1);
  });

  it('una fila que ya llegó terminada no invalida nada', async () => {
    const { result, invalidar, cliente } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    expect(intervaloDe(cliente, clavesCargas.lista(1))).toBe(false);
    await esperarIntervalos();
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('si la época cambió antes de resolverse, no invalida nada de otra época', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    let epoca = 1;
    const { result, rerender, invalidar } = montar({
      epoca: () => epoca,
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: compuerta.promesa });
    almacenes.cargas.avanzar(PENDIENTE.id, 'procesada', { registrosOk: 3 });
    // El siguiente sondeo de la época 1 queda retenido (llegó al servidor y
    // espera la compuerta); solo entonces la sesión cambia.
    const antesDelRetenido = espia.cuantas('GET', '/api/cargas');
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(
        antesDelRetenido,
      ),
    );
    epoca = 2;
    rerender();
    compuerta.abrir();
    await waitFor(() =>
      expect(result.current.lista.data?.datos[0]?.estado).toBe('procesada'),
    );
    await esperarIntervalos();
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['bandeja', 1] });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['bandeja', 2] });
    espia.detener();
  });
});

describe('usePollingCargas: sin sesión lista', () => {
  it('no pide nada mientras la época es null', async () => {
    const espia = espiarSolicitudes();
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => usePollingCargas(null), {
      wrapper: envolturaCargas(
        cliente,
        () => ({ status: 'loading', restaurarOrigen: false }),
        { intervaloMs: 15, topeMs: 60_000 },
      ),
    });
    await esperarIntervalos();
    expect(result.current.lista.fetchStatus).toBe('idle');
    expect(espia.solicitudes).toHaveLength(0);
    espia.detener();
  });
});
