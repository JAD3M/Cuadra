import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionStateProvider } from '@/shared/sesion';
import { SESION_LISTA } from '@/test/fixtures';
import {
  bandejaFalla,
  bandejaRedDeFallo,
  filaBandeja,
  resumenFalla,
} from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { clienteDePruebas } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { BandejaPage } from './BandejaPage';
import {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  VACIO_CON_FILTROS,
  VACIO_POR_DEFECTO,
} from './textos';

/** Registra la query de cada `GET /bandeja` y cada método distinto de GET. */
function espiar() {
  const listas: string[] = [];
  const noGet: string[] = [];
  const oyente = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (request.method !== 'GET') noGet.push(request.method);
    if (url.pathname === '/api/bandeja') listas.push(url.search);
  };
  servidor.events.on('request:start', oyente);
  return {
    listas,
    noGet,
    detener: () => servidor.events.removeListener('request:start', oyente),
  };
}

function montar(entrada: string) {
  const router = createMemoryRouter(
    [
      { path: '/bandeja', element: <BandejaPage /> },
      { path: '/casos/:id', element: <p>Detalle del caso</p> },
    ],
    { initialEntries: [entrada] },
  );
  const cliente = clienteDePruebas();
  render(
    <QueryClientProvider client={cliente}>
      <SessionStateProvider estado={SESION_LISTA}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
  const ubicacion = () =>
    router.state.location.pathname + router.state.location.search;
  return { router, ubicacion, cliente };
}

const filasDeDatos = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

const chip = (nombre: string) => screen.getByRole('button', { name: nombre });

async function esperarTabla() {
  await screen.findByRole('table');
}

describe('BandejaPage: carga y filtros', () => {
  it('por defecto pide solo sugerencia y sin match, 20 por página, y muestra el total', async () => {
    const espia = espiar();
    const { ubicacion } = montar('/bandeja');
    await esperarTabla();
    espia.detener();
    expect(espia.listas).toEqual([
      '?estado=sugerencia&estado=sin_match&pagina=1&limite=20',
    ]);
    expect(filasDeDatos()).toHaveLength(20);
    expect(screen.getByText('Mostrando 1–20 de 39')).toBeInTheDocument();
    expect(ubicacion()).toBe('/bandeja');
    expect(chip('Sugerencia')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Sin match')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Conciliado')).toHaveAttribute('aria-pressed', 'false');
  });

  it('alternar un chip reemplaza la entrada, reinicia la página y escribe el estado en orden canónico', async () => {
    const usuario = userEvent.setup();
    const espia = espiar();
    const { router, ubicacion } = montar('/bandeja?pagina=2');
    await esperarTabla();
    const entradas = window.history.length;

    await usuario.click(chip('Sin match'));
    await waitFor(() => expect(ubicacion()).toBe('/bandeja?estado=sugerencia'));
    await usuario.click(chip('Conciliado'));
    await waitFor(() =>
      expect(ubicacion()).toBe('/bandeja?estado=sugerencia&estado=conciliado'),
    );
    espia.detener();
    expect(router.state.historyAction).toBe('REPLACE');
    expect(window.history.length).toBe(entradas);
    expect(espia.listas.at(-1)).toBe(
      '?estado=conciliado&estado=sugerencia&pagina=1&limite=20',
    );
    expect(espia.noGet).toEqual([]);
  });

  it('el último chip activo no se apaga y no se pide un estado vacío', async () => {
    const usuario = userEvent.setup();
    const espia = espiar();
    const { ubicacion } = montar('/bandeja?estado=conciliado');
    await esperarTabla();
    await usuario.click(chip('Conciliado'));
    espia.detener();
    expect(ubicacion()).toBe('/bandeja?estado=conciliado');
    expect(chip('Conciliado')).toHaveAttribute('aria-pressed', 'true');
    expect(espia.listas).toEqual(['?estado=conciliado&pagina=1&limite=20']);
    expect(
      screen.getByText('Debe quedar al menos un estado activo.'),
    ).toBeInTheDocument();
  });

  it('una URL no canónica se normaliza con replace y nunca pide parámetros inválidos', async () => {
    const espia = espiar();
    const { router, ubicacion } = montar('/bandeja?estado=zzz&pagina=0');
    await esperarTabla();
    await waitFor(() => expect(ubicacion()).toBe('/bandeja'));
    espia.detener();
    expect(router.state.historyAction).toBe('REPLACE');
    expect(espia.listas).toEqual([
      '?estado=sugerencia&estado=sin_match&pagina=1&limite=20',
    ]);
  });

  it('ignora limite y claves ajenas y no las reenvía', async () => {
    const espia = espiar();
    const { ubicacion } = montar('/bandeja?limite=500&x=1');
    await esperarTabla();
    await waitFor(() => expect(ubicacion()).toBe('/bandeja'));
    espia.detener();
    expect(espia.listas).toEqual([
      '?estado=sugerencia&estado=sin_match&pagina=1&limite=20',
    ]);
  });
});

describe('BandejaPage: paginación', () => {
  it('cambiar de página empuja historial, enfoca la región de resultados y Atrás vuelve', async () => {
    const usuario = userEvent.setup();
    const { router, ubicacion } = montar('/bandeja');
    await esperarTabla();
    const primeraFila = filasDeDatos()[0]?.textContent;

    await usuario.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    expect(ubicacion()).toBe('/bandeja?pagina=2');
    expect(router.state.historyAction).toBe('PUSH');
    await waitFor(() =>
      expect(screen.getByText('Mostrando 21–39 de 39')).toBeInTheDocument(),
    );
    expect(filasDeDatos()).toHaveLength(19);
    const resultados = screen.getByRole('region', {
      name: /Movimientos por revisar/,
    }).parentElement;
    expect(resultados).toHaveFocus();

    // Dentro de `act`: el router actualiza su estado en una transición de
    // React; sin `act`, el sondeo de `waitFor` (cada intento fallido arma
    // un error con el DOM completo) le quita el turno bajo carga de CPU.
    await act(() => router.navigate(-1));
    await waitFor(() =>
      expect(screen.getByText('Mostrando 1–20 de 39')).toBeInTheDocument(),
    );
    expect(filasDeDatos()[0]?.textContent).toBe(primeraFila);
  });

  it('no mueve el foco en la primera carga ni al alternar un chip', async () => {
    const usuario = userEvent.setup();
    montar('/bandeja');
    await esperarTabla();
    const resultados = screen.getByRole('region', {
      name: /Movimientos por revisar/,
    }).parentElement;
    expect(resultados).not.toHaveFocus();
    await usuario.click(chip('Conciliado'));
    await waitFor(() =>
      expect(screen.getByText('Mostrando 1–20 de 43')).toBeInTheDocument(),
    );
    expect(resultados).not.toHaveFocus();
  });

  it('una página fuera de rango se reemplaza por la última sin mostrar el vacío', async () => {
    const espia = espiar();
    const { router, ubicacion } = montar('/bandeja?pagina=99');
    await waitFor(() => expect(ubicacion()).toBe('/bandeja?pagina=2'));
    expect(screen.queryByText(VACIO_CON_FILTROS.titulo)).toBeNull();
    expect(screen.queryByText(VACIO_POR_DEFECTO.titulo)).toBeNull();
    await waitFor(() =>
      expect(screen.getByText('Mostrando 21–39 de 39')).toBeInTheDocument(),
    );
    espia.detener();
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByText(VACIO_POR_DEFECTO.titulo)).toBeNull();
  });

  it('total 0 con página 3 vuelve a la página 1 y muestra el vacío', async () => {
    servidor.use(
      http.get('/api/bandeja', ({ request }) => {
        const pagina = Number(new URL(request.url).searchParams.get('pagina'));
        return HttpResponse.json({ datos: [], pagina, limite: 20, total: 0 });
      }),
    );
    const { ubicacion } = montar('/bandeja?pagina=3');
    await waitFor(() => expect(ubicacion()).toBe('/bandeja'));
    expect(
      await screen.findByText(VACIO_POR_DEFECTO.titulo),
    ).toBeInTheDocument();
  });

  it('conserva las filas anteriores con aria-busy mientras carga la siguiente página', async () => {
    const usuario = userEvent.setup();
    montar('/bandeja');
    await esperarTabla();
    servidor.use(
      http.get('/api/bandeja', async () => {
        await delay(150);
        return HttpResponse.json({
          datos: [filaBandeja()],
          pagina: 2,
          limite: 20,
          total: 39,
        });
      }),
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    const resultados = screen.getByRole('region', {
      name: /Movimientos por revisar/,
    }).parentElement;
    expect(resultados).toHaveAttribute('aria-busy', 'true');
    expect(filasDeDatos()).toHaveLength(20);
    await waitFor(() => expect(filasDeDatos()).toHaveLength(1));
    expect(resultados).toHaveAttribute('aria-busy', 'false');
  });

  it('el estado de rango se actualiza solo cuando llegan los datos', async () => {
    const usuario = userEvent.setup();
    montar('/bandeja');
    await esperarTabla();
    servidor.use(
      http.get('/api/bandeja', async () => {
        await delay(150);
        return HttpResponse.json({
          datos: [filaBandeja()],
          pagina: 2,
          limite: 20,
          total: 39,
        });
      }),
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    expect(screen.getByText('Mostrando 1–20 de 39')).toBeInTheDocument();
    expect(
      await screen.findByText('Mostrando 21–39 de 39'),
    ).toBeInTheDocument();
  });
});

describe('BandejaPage: estados', () => {
  it('muestra el esqueleto con aria-busy en la primera carga', async () => {
    servidor.use(
      http.get('/api/bandeja', async () => {
        await delay(100);
        return HttpResponse.json({
          datos: [],
          pagina: 1,
          limite: 20,
          total: 0,
        });
      }),
    );
    montar('/bandeja');
    expect(screen.getByLabelText('Cargando movimientos')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      await screen.findByText(VACIO_POR_DEFECTO.titulo),
    ).toBeInTheDocument();
  });

  it('vacío con filtros ofrece restablecer y vuelve a la vista por defecto', async () => {
    const usuario = userEvent.setup();
    servidor.use(
      http.get('/api/bandeja', ({ request }) => {
        const estados = new URL(request.url).searchParams.getAll('estado');
        const vacio = estados.length === 1 && estados[0] === 'conciliado';
        return HttpResponse.json({
          datos: vacio ? [] : [filaBandeja()],
          pagina: 1,
          limite: 20,
          total: vacio ? 0 : 1,
        });
      }),
    );
    const { ubicacion } = montar('/bandeja?estado=conciliado');
    expect(
      await screen.findByText(VACIO_CON_FILTROS.titulo),
    ).toBeInTheDocument();
    await usuario.click(
      screen.getByRole('button', { name: 'Restablecer filtros' }),
    );
    await esperarTabla();
    expect(ubicacion()).toBe('/bandeja');
  });

  it('vacío por defecto no ofrece restablecer', async () => {
    servidor.use(
      http.get('/api/bandeja', () =>
        HttpResponse.json({ datos: [], pagina: 1, limite: 20, total: 0 }),
      ),
    );
    montar('/bandeja');
    expect(
      await screen.findByText(VACIO_POR_DEFECTO.titulo),
    ).toBeInTheDocument();
    expect(screen.getByText(VACIO_POR_DEFECTO.detalle)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restablecer filtros' }),
    ).toBeNull();
  });

  it('un 500 muestra la alerta mapeada con su detalle y Reintentar vuelve a pedir', async () => {
    const usuario = userEvent.setup();
    servidor.use(bandejaFalla(500));
    montar('/bandeja');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(ERROR_CONEXION.titulo);
    expect(alerta).toHaveTextContent(ERROR_CONEXION.detalle);
    expect(alerta).not.toHaveTextContent('detalle del servidor');
    servidor.resetHandlers();
    await usuario.click(
      within(alerta).getByRole('button', { name: 'Reintentar' }),
    );
    await esperarTabla();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un fallo de red usa el mismo mensaje de conexión', async () => {
    servidor.use(bandejaRedDeFallo());
    montar('/bandeja');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ERROR_CONEXION.titulo,
    );
  });

  it('un 403 muestra el permiso sin reintento, mantiene la sesión y no redirige', async () => {
    servidor.use(bandejaFalla(403));
    const { ubicacion } = montar('/bandeja');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(ERROR_SIN_PERMISO.titulo);
    expect(alerta).toHaveTextContent(ERROR_SIN_PERMISO.detalle);
    expect(
      within(alerta).queryByRole('button', { name: 'Reintentar' }),
    ).toBeNull();
    expect(ubicacion()).toBe('/bandeja');
    expect(chip('Sugerencia')).toBeInTheDocument();
  });
});

describe('BandejaPage: indicadores', () => {
  it('muestra los conteos y el monto del resumen', async () => {
    montar('/bandeja');
    await esperarTabla();
    expect(await screen.findByText('26')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    // El conjunto de ejemplo tiene una fila en USD: una línea por moneda.
    expect(screen.getByText('En sugerencias y sin match')).toBeInTheDocument();
    expect(screen.getByText(/\$2,150\.00 USD/)).toBeInTheDocument();
  });

  it('un fallo del resumen no oculta la tabla y Reintentar recupera los indicadores', async () => {
    const usuario = userEvent.setup();
    servidor.use(resumenFalla(500));
    montar('/bandeja');
    await esperarTabla();
    const reintentar = await screen.findByRole('button', {
      name: 'Reintentar',
    });
    servidor.resetHandlers();
    await usuario.click(reintentar);
    expect(await screen.findByText('26')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('un fallo de la lista no oculta los indicadores', async () => {
    servidor.use(bandejaFalla(500));
    montar('/bandeja');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByText('26')).toBeInTheDocument();
  });

  it('los indicadores no dependen del filtro activo', async () => {
    montar('/bandeja?estado=conciliado');
    await esperarTabla();
    expect(await screen.findByText('26')).toBeInTheDocument();
  });
});

describe('BandejaPage: solo lectura', () => {
  it('solo emite GET y no tiene controles de decisión ni textos del servidor', async () => {
    const usuario = userEvent.setup();
    const espiaGet = espiarSolicitudes();
    const espia = espiar();
    montar('/bandeja');
    await esperarTabla();
    await usuario.click(chip('Conciliado'));
    await usuario.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Mostrando 21–/)).toBeInTheDocument(),
    );
    espia.detener();
    espiaGet.detener();
    expect(espia.noGet).toEqual([]);
    expect(
      screen.queryByRole('button', { name: /confirmar|rechazar|cerrar/i }),
    ).toBeNull();
  });
});
