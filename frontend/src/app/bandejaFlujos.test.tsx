import {
  act,
  configure,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import { CONTEXTO_SESION_B, EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import { bandejaFalla, filaBandeja, resumenDe } from '@/test/fixturesBandeja';
import { contextoPorToken, espiarSolicitudes } from '@/test/handlersAuth';
import {
  elegirEmpresaPorNombre,
  entrarALaApp,
  montarApp,
} from '@/test/montarApp';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

let espia: ReturnType<typeof espiarSolicitudes> | null = null;

afterEach(() => {
  espia?.detener();
  espia = null;
});

/** Conciliado + sugerencia: 30 filas, dos páginas de 20. */
const DOS_PAGINAS = '/bandeja?estado=sugerencia&estado=conciliado&pagina=2';

const filasDeDatos = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('flujos de la bandeja', () => {
  it('tras el login /bandeja muestra el título, el subtítulo y las filas', async () => {
    montarApp('/bandeja');
    await entrarALaApp();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Bandeja de revisión',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Movimientos abiertos, del monto más alto al más bajo'),
    ).toBeInTheDocument();
    await screen.findByRole('table');
    expect(filasDeDatos()).toHaveLength(20);
  });

  it('abrir un caso va a /casos/:id, deja Bandeja activa y no emite mutaciones', async () => {
    espia = espiarSolicitudes();
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByRole('table');
    const enlace = within(screen.getByRole('table')).getAllByRole('link')[0];
    const href = enlace?.getAttribute('href') ?? '';
    expect(href).toMatch(/^\/casos\//);

    await userEvent.setup().click(enlace!);
    await waitFor(() => expect(router.state.location.pathname).toBe(href));
    expect(screen.getByRole('link', { name: /^Bandeja/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // El login y la elección de empresa son POST de /auth; el resto, solo GET.
    expect(
      espia.solicitudes.filter(
        (s) => s.metodo !== 'GET' && !s.ruta.startsWith('/api/auth/'),
      ),
    ).toEqual([]);
  });

  it('Atrás desde un caso restaura el filtro y la página', async () => {
    const { router } = montarApp(DOS_PAGINAS);
    await entrarALaApp();
    await screen.findByText('Mostrando 21–30 de 30');
    const enlace = within(screen.getByRole('table')).getAllByRole('link')[0];
    await userEvent.setup().click(enlace!);
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/casos\//),
    );

    // Dentro de `act`: el router actualiza su estado en una transición de
    // React; sin `act`, el sondeo de `waitFor` (cada intento fallido arma
    // un error con el DOM completo) le quita el turno bajo carga de CPU.
    await act(() => router.navigate(-1));
    await screen.findByText('Mostrando 21–30 de 30');
    expect(router.state.location.pathname + router.state.location.search).toBe(
      DOS_PAGINAS,
    );
  });

  it('un enlace compartido (tras el login) pide el mismo filtro y página', async () => {
    espia = espiarSolicitudes();
    const urls: string[] = [];
    servidor.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/bandeja') urls.push(url.search);
    });
    const { router } = montarApp(DOS_PAGINAS);
    await entrarALaApp();
    await screen.findByText('Mostrando 21–30 de 30');
    servidor.events.removeAllListeners();
    expect(urls).toEqual([
      '?estado=conciliado&estado=sugerencia&pagina=2&limite=20',
    ]);
    expect(router.state.location.pathname + router.state.location.search).toBe(
      DOS_PAGINAS,
    );
  });

  it('un 401 de la lista termina la sesión y guarda /bandeja con su consulta como destino', async () => {
    const { router } = montarApp('/bandeja?estado=conciliado');
    await entrarALaApp();
    await screen.findByRole('table');
    servidor.use(bandejaFalla(401));
    // Un cambio de filtro pide la lista otra vez y recibe el 401.
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Sin match' }));
    await screen.findByText(AVISOS.sesion_expirada);
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/bandeja' },
    });
  });

  it('al cambiar de empresa solo se ven los datos de la nueva, nunca los de la anterior', async () => {
    const idB = EMPRESAS_DISPONIBLES[1]!.id;
    contextoPorToken(idB);
    const filasA = [filaBandeja({ descripcion: 'Fila de la empresa A' })];
    const filasB = [
      filaBandeja({
        movimientoId: '11111111-1111-4111-8111-111111111111',
        descripcion: 'Fila de la empresa B',
      }),
    ];
    const deB = (request: Request) =>
      (request.headers.get('Authorization') ?? '').endsWith(idB);
    servidor.use(
      http.get('/api/bandeja', ({ request }) =>
        HttpResponse.json({
          datos: deB(request) ? filasB : filasA,
          pagina: 1,
          limite: 20,
          total: 1,
        }),
      ),
      http.get('/api/bandeja/resumen', ({ request }) =>
        HttpResponse.json(resumenDe(deB(request) ? filasB : filasA)),
      ),
    );
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByText('Fila de la empresa A');

    const usuario = userEvent.setup();
    await usuario.click(
      screen.getByRole('button', { name: /Cambiar de empresa/ }),
    );
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByText('Fila de la empresa B');
    expect(screen.queryByText('Fila de la empresa A')).toBeNull();
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(
      screen.getByText(CONTEXTO_SESION_B.empresa.razonSocial),
    ).toBeInTheDocument();
  });

  it('cerrar sesión limpia la caché: al volver a entrar se pide la lista otra vez', async () => {
    espia = espiarSolicitudes();
    montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByRole('table');
    expect(espia.cuantas('GET', '/api/bandeja')).toBe(1);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByText(AVISOS.cierre_voluntario);
    await entrarALaApp();
    await screen.findByRole('table');
    expect(espia.cuantas('GET', '/api/bandeja')).toBe(2);
    expect(espia.cuantas('GET', '/api/bandeja/resumen')).toBe(2);
  });
});
