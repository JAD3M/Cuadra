import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { focusManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import { LISTA_CINCO_ESTADOS } from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { listaFalla } from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import type { ConfigPolling } from './ContextoPolling';
import { servidor } from '@/test/servidor';
import { CargasPage } from './CargasPage';

function montar(polling?: ConfigPolling) {
  return render(<CargasPage />, {
    wrapper: envolturaCargas(clienteDePruebas(), undefined, polling),
  });
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe('CargasPage: historial', () => {
  it('mientras llega la lista muestra el esqueleto y luego la tabla (1.1)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: compuerta.promesa });
    montar();
    expect(await screen.findByText('Cargando cargas')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    compuerta.abrir();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Cargando cargas')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(21);
  });

  it('con cargas en los cinco estados pinta cada chip', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar();
    const tabla = await screen.findByRole('table');
    for (const chip of [
      'Pendiente',
      'Procesando',
      'Procesada',
      'Con errores',
      'Fallida',
    ]) {
      expect(within(tabla).getByText(chip)).toBeInTheDocument();
    }
  });

  it('una lista vacía muestra «Aún no hay cargas.» (1.2)', async () => {
    almacenes.cargas.establecer([]);
    montar();
    expect(await screen.findByText('Aún no hay cargas.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un 500 muestra solo el texto de conectividad y «Reintentar» vuelve a pedir (1.3, 1.5)', async () => {
    servidor.use(listaFalla(500));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).not.toHaveTextContent('detalle del servidor');
    servidor.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 403 muestra el texto de permiso y no ofrece «Reintentar»', async () => {
    servidor.use(listaFalla(403));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('solo pide GET /cargas: ninguna fila del historial pide el detalle (2.5)', async () => {
    const espia = espiarSolicitudes();
    montar();
    await screen.findByRole('table');
    // Control positivo: la lista sí se pidió, una vez.
    await waitFor(() => expect(espia.cuantas('GET', '/api/cargas')).toBe(1));
    for (const fila of screen.getAllByRole('row').slice(1)) {
      await userEvent.click(fila);
    }
    await esperarIntervalos();
    expect(screen.queryByRole('link')).toBeNull();
    expect(espia.solicitudes.map((s) => `${s.metodo} ${s.ruta}`)).toEqual([
      'GET /api/cargas',
    ]);
    espia.detener();
  });

  it('mantiene el marcador de la pantalla hasta que llegue la pantalla completa', async () => {
    montar();
    await screen.findByRole('table');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cargas recientes' }),
    ).toBeInTheDocument();
  });
});

const HOLGADO: ConfigPolling = { intervaloMs: 15, topeMs: 10_000 };
const CON_TOPE: ConfigPolling = { intervaloMs: 15, topeMs: 120 };
const LEYENDA = 'Se actualiza sola mientras procesa';
const SIN_ACTUALIZAR = 'La lista dejó de actualizarse.';

describe('CargasPage: aviso de actualización del historial', () => {
  it('con cargas activas dice que se actualiza sola y no ofrece «Actualizar» (G13, K5)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar(HOLGADO);
    await screen.findByRole('table');
    expect(screen.getByText(LEYENDA)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
  });

  it('sin cargas activas no hay leyenda ni aviso', async () => {
    almacenes.cargas.establecer(
      LISTA_CINCO_ESTADOS.filter((c) => c.estado === 'procesada'),
    );
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByRole('table');
    await esperarIntervalos(5);
    expect(screen.queryByText(LEYENDA)).toBeNull();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(1);
    espia.detener();
  });

  it('el esqueleto, el vacío y el error no llevan leyenda (mockup)', async () => {
    almacenes.cargas.establecer([]);
    montar(HOLGADO);
    await screen.findByText('Aún no hay cargas.');
    expect(screen.queryByText(LEYENDA)).toBeNull();
  });

  it('al vencer el tope una fila pendiente sigue ahí, aparece «Actualizar» y no se pide nada más (11.3)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByRole('table');
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.queryByText(LEYENDA)).toBeNull();
    // Control positivo: antes del tope la lista se pidió varias veces.
    expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(2);
    const pedidas = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(pedidas);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    espia.detener();
  });

  it('«Actualizar» vuelve a pedir, oculta el aviso y reabre la ventana (11.5)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByText(SIN_ACTUALIZAR);
    const antes = espia.cuantas('GET', '/api/cargas');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText(LEYENDA)).toBeInTheDocument();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(
        antes + 3,
      ),
    );
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    espia.detener();
  });

  it('con la pestaña oculta no pide solo y al volver sigue (11.6)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(HOLGADO);
    await screen.findByRole('table');
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(1),
    );
    act(() => focusManager.setFocused(false));
    await esperarIntervalos(3);
    const congeladas = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(congeladas);
    act(() => focusManager.setFocused(true));
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(congeladas),
    );
    espia.detener();
  });

  it('un sondeo que falla mantiene la tabla y no pinta alerta (11.9)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(HOLGADO);
    await screen.findByRole('table');
    servidor.use(listaFalla(500));
    const antes = espia.cuantas('GET', '/api/cargas');
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(antes + 1),
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    espia.detener();
  });
});
