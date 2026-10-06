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
import { POLLING_RAPIDO, envolturaCargas, esperar } from '@/test/montarCargas';
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
    await waitFor(() => expect(espia.cuantas('GET', '/api/cargas')).toBe(3));
    expect(result.current.lista.data?.datos[0]?.estado).toBe('pendiente');
    espia.detener();
  });

  it('se detiene sin pedir de más cuando todas quedan terminadas', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result } = montar({ polling: { intervaloMs: 15, topeMs: 60_000 } });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(2),
    );
    almacenes.cargas.avanzar(PENDIENTE.id, 'procesada', { registrosOk: 3 });
    await waitFor(() =>
      expect(result.current.lista.data?.datos[0]?.estado).toBe('procesada'),
    );
    const total = espia.cuantas('GET', '/api/cargas');
    await esperar(90);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(total);
    espia.detener();
  });

  it('con la lista vacía no hay polling', async () => {
    almacenes.cargas.establecer([]);
    const espia = espiarSolicitudes();
    const { result } = montar({ polling: POLLING_RAPIDO });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    await esperar(60);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(1);
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
    const { result } = montar({ polling: { intervaloMs: 15, topeMs: 60_000 } });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const antes = espia.cuantas('GET', '/api/cargas');
    await esperar(90);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(antes);
    act(() => {
      focusManager.setFocused(true);
    });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(antes),
    );
    espia.detener();
  });

  it('al desmontar no queda temporizador ni petición', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    const espia = espiarSolicitudes();
    const { result, unmount } = montar({
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(2),
    );
    expect(result.current.lista.isSuccess).toBe(true);
    unmount();
    const total = espia.cuantas('GET', '/api/cargas');
    await esperar(90);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(total);
    espia.detener();
  });

  it('cambiar de época con una petición en vuelo no escribe la respuesta vieja', async () => {
    const compuerta = crearCompuerta();
    let llamadas = 0;
    servidor.use(
      http.get('/api/cargas', async () => {
        llamadas += 1;
        if (llamadas === 1) {
          await compuerta.promesa;
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
    await esperar(40);
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
    const { result } = montar({ polling: POLLING_RAPIDO });
    await waitFor(() => expect(result.current.capada).toBe(true));
    await esperar(45);
    const alCapar = espia.cuantas('GET', '/api/cargas');
    await esperar(90);
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
    const { result } = montar({ panel: panelDe(inicial) });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    await esperar(30);
    expect(result.current.consultaPanel.fetchStatus).toBe('idle');
    expect(result.current.panelDatos).toBe(inicial);
    expect(espia.cuantas('GET', `/api/cargas/${inicial.id}`)).toBe(0);
    espia.detener();
  });

  it('el panel de otra época no se consulta ni se entrega', async () => {
    const espia = espiarSolicitudes();
    const { result } = montar({ panel: panelDe(respuestaNueva(50), 7) });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    await esperar(30);
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

  it('una fila que ya llegó terminada no invalida nada', async () => {
    const { result, invalidar } = montar();
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    await esperar(30);
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('si la época cambió antes de resolverse, no invalida nada de otra época', async () => {
    almacenes.cargas.establecer([PENDIENTE]);
    let epoca = 1;
    const { result, rerender, invalidar } = montar({
      epoca: () => epoca,
      polling: { intervaloMs: 15, topeMs: 60_000 },
    });
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: compuerta.promesa });
    almacenes.cargas.avanzar(PENDIENTE.id, 'procesada', { registrosOk: 3 });
    // El siguiente sondeo de la época 1 queda retenido; la sesión cambia.
    await esperar(40);
    epoca = 2;
    rerender();
    compuerta.abrir();
    await waitFor(() =>
      expect(result.current.lista.data?.datos[0]?.estado).toBe('procesada'),
    );
    await esperar(40);
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['bandeja', 1] });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['bandeja', 2] });
  });
});

describe('usePollingCargas: sin sesión lista', () => {
  it('no pide nada mientras la época es null', async () => {
    const espia = espiarSolicitudes();
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => usePollingCargas(null), {
      wrapper: envolturaCargas(cliente, () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperar(30);
    expect(result.current.lista.fetchStatus).toBe('idle');
    expect(espia.solicitudes).toHaveLength(0);
    espia.detener();
  });
});
