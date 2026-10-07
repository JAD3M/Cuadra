import {
  configure,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  EVENTOS_MAQUETA,
  generarEventos,
  USUARIOS_BITACORA,
} from '@/test/fixturesBitacora';
import { almacenes } from '@/test/handlers';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { listaFalla, usuariosFalla } from '@/test/handlersBitacora';
import { esperarIntervalos } from '@/test/esperar';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const bitacora = almacenes.bitacora;
const LUIS = USUARIOS_BITACORA[1]!;

let espia: ReturnType<typeof espiarSolicitudes> | null = null;

beforeEach(() => {
  bitacora.establecer(EVENTOS_MAQUETA);
});

afterEach(() => {
  espia?.detener();
  espia = null;
});

const usuario = () => userEvent.setup();

/** Las peticiones del listado que llegaron al servidor, con su consulta. */
const consultasLista = () =>
  bitacora
    .peticiones()
    .filter((p) => p.ruta === '/api/bitacora')
    .map((p) => p.consulta);

const filasDeDatos = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

async function abrir(entrada = '/bitacora') {
  const montada = montarApp(entrada);
  await entrarALaApp();
  return montada;
}

/** Espera a que la lista termine de cargar y no quede nada ocupado. */
async function esperarLista(filas: number) {
  await waitFor(() => expect(filasDeDatos()).toHaveLength(filas));
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
}

describe('flujos de la bitácora: la pantalla', () => {
  it('tras el login muestra título, subtítulo, filtros, las filas y la paginación', async () => {
    await abrir();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bitácora' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Quién hizo qué y cuándo. Solo lectura, nadie la edita.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Filtros de la bitácora' }),
    ).toBeInTheDocument();
    await esperarLista(7);
    expect(
      screen.getByRole('region', { name: 'Eventos de la bitácora' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–7 de 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Bitácora/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(consultasLista()).toEqual([{ pagina: '1', limite: '50' }]);
  });

  it('es de solo lectura: solo hace GET y la tabla no tiene botones ni enlaces', async () => {
    espia = espiarSolicitudes();
    await abrir();
    await esperarLista(7);
    const tabla = screen.getByRole('table');
    expect(within(tabla).queryByRole('button')).toBeNull();
    expect(within(tabla).queryByRole('link')).toBeNull();
    expect(
      espia.solicitudes.filter(
        (s) => s.metodo !== 'GET' && !s.ruta.startsWith('/api/auth/'),
      ),
    ).toEqual([]);
  });

  it('el acceso denegado se distingue a simple vista: fila y chip propios', async () => {
    await abrir();
    await esperarLista(7);
    const denegadas = filasDeDatos().filter((f) =>
      /filaDenegada/.test(f.className),
    );
    expect(denegadas).toHaveLength(1);
    expect(within(denegadas[0]!).getByText('acceso_denegado')).toHaveAttribute(
      'data-tono',
      'denegado',
    );
  });

  it('acciones y entidades se ven con el nombre de la API', async () => {
    await abrir();
    await esperarLista(7);
    const tabla = screen.getByRole('table');
    for (const texto of ['confirmar', 'rechazar', 'actualizar', 'companies']) {
      expect(within(tabla).getAllByText(texto).length).toBeGreaterThan(0);
    }
  });

  it('una URL no canónica se normaliza sin crear historial', async () => {
    const { router } = await abrir('/bitacora?foo=1&accion=borrar&pagina=1');
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.historyAction).toBe('REPLACE');
  });
});

describe('flujos de la bitácora: filtros', () => {
  it('filtrar por acción reescribe la URL, pide al servidor y vuelve a la página 1', async () => {
    const { router } = await abrir();
    await esperarLista(7);
    await usuario().selectOptions(
      screen.getByLabelText('Acción'),
      'acceso_denegado',
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe('?accion=acceso_denegado'),
    );
    await esperarLista(1);
    expect(consultasLista().at(-1)).toEqual({
      accion: 'acceso_denegado',
      pagina: '1',
      limite: '50',
    });
  });

  it('filtrar por entidad y por usuario manda entidad y userId', async () => {
    const { router } = await abrir();
    await esperarLista(7);
    await usuario().selectOptions(
      screen.getByLabelText('Entidad'),
      'companies',
    );
    await esperarLista(2);
    await waitFor(() =>
      expect(screen.getByLabelText('Usuario')).toContainHTML('Luis Reyes'),
    );
    await usuario().selectOptions(screen.getByLabelText('Entidad'), 'Todas');
    await esperarLista(7);
    await usuario().selectOptions(
      screen.getByLabelText('Usuario'),
      'Luis Reyes',
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe(`?usuario=${LUIS.id}`),
    );
    await esperarLista(2);
    expect(consultasLista()).toContainEqual({
      entidad: 'companies',
      pagina: '1',
      limite: '50',
    });
    expect(consultasLista().at(-1)).toEqual({
      userId: LUIS.id,
      pagina: '1',
      limite: '50',
    });
  });

  it('filtrar por fechas manda el día local completo y no da 400', async () => {
    await abrir();
    await esperarLista(7);
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-09-30' },
    });
    await esperarLista(7);
    const ultima = consultasLista().at(-1);
    expect(ultima?.desde).toBe(new Date(2026, 8, 1).toISOString());
    expect(ultima?.hasta).toBe(new Date(2026, 9, 1).toISOString());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un rango invertido avisa y no envía nada', async () => {
    await abrir('/bitacora?desde=2026-10-05&hasta=2026-09-30');
    const hasta = await screen.findByLabelText('Hasta');
    expect(hasta).toHaveAccessibleDescription(
      '«Desde» no puede ser posterior a «Hasta».',
    );
    await esperarIntervalos();
    expect(consultasLista()).toEqual([]);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin resultados ofrece restablecer y vuelve a la lista completa', async () => {
    const { router } = await abrir('/bitacora?accion=cargar');
    expect(
      await screen.findByText('No hay eventos con estos filtros.'),
    ).toBeInTheDocument();
    await usuario().click(
      screen.getByRole('button', { name: 'Restablecer filtros' }),
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await esperarLista(7);
    expect(screen.getByLabelText('Acción')).toHaveValue('');
  });

  it('si la lista de usuarios falla, los eventos se siguen viendo', async () => {
    servidor.use(usuariosFalla(403));
    await abrir();
    await esperarLista(7);
    await waitFor(() =>
      expect(screen.getByLabelText('Usuario')).toHaveAccessibleDescription(
        'No se pudo cargar la lista de usuarios.',
      ),
    );
  });
});

describe('flujos de la bitácora: paginación', () => {
  it('312 eventos son siete páginas de 50; ir a la siguiente pide la página 2', async () => {
    bitacora.establecer(generarEventos(312));
    const { router } = await abrir();
    await esperarLista(50);
    expect(screen.getByText('Mostrando 1–50 de 312')).toBeInTheDocument();
    await usuario().click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?pagina=2'));
    await waitFor(() =>
      expect(screen.getByText('Mostrando 51–100 de 312')).toBeInTheDocument(),
    );
    expect(consultasLista().at(-1)).toEqual({ pagina: '2', limite: '50' });
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('una página que ya no existe pasa a la última sin historial', async () => {
    bitacora.establecer(generarEventos(60));
    const { router } = await abrir('/bitacora?pagina=9');
    await waitFor(() => expect(router.state.location.search).toBe('?pagina=2'));
    await esperarLista(10);
    expect(router.state.historyAction).toBe('REPLACE');
  });
});

describe('flujos de la bitácora: vacío y errores', () => {
  it('sin eventos explica qué aparecerá, sin restablecer', async () => {
    bitacora.establecer([]);
    await abrir();
    expect(
      await screen.findByText('Aún no hay eventos en la bitácora.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restablecer filtros' }),
    ).toBeNull();
  });

  it('un 403 muestra el aviso de permiso sin Reintentar ni el texto del servidor', async () => {
    servidor.use(listaFalla(403, 'Forbidden resource'));
    await abrir();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).not.toHaveTextContent('Forbidden');
    expect(within(alerta).queryByRole('button')).toBeNull();
  });

  it('otro fallo muestra el aviso genérico y Reintentar vuelve a pedir', async () => {
    servidor.use(listaFalla(400, 'desde must be a valid ISO 8601'));
    await abrir();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).not.toHaveTextContent('ISO');
    servidor.resetHandlers();
    await usuario().click(
      within(alerta).getByRole('button', { name: 'Reintentar' }),
    );
    await esperarLista(7);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
