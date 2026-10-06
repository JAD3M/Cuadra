import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import { LISTA_CINCO_ESTADOS } from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { listaFalla } from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { CargasPage } from './CargasPage';

function montar() {
  return render(<CargasPage />, {
    wrapper: envolturaCargas(clienteDePruebas()),
  });
}

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
