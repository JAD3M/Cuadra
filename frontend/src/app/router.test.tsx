import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/shared/api';
import { ThemeProvider } from '@/shared/tema';
import {
  SessionStateProvider,
  type AccionesSesion,
  type SessionState,
} from '@/shared/sesion';
import { SESION_LISTA } from '@/test/fixtures';
import { contextoFalla, espiarSolicitudes } from '@/test/handlersAuth';
import {
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
} from '@/test/handlersPlataforma';
import { montarApp } from '@/test/montarApp';
import { ESTADOS, terminada } from '@/test/montarRutas';
import { rutas } from './router';

/** Acciones inertas: la pantalla de acceso las exige, estas pruebas no las usan. */
const ACCIONES: AccionesSesion = {
  iniciarSesion: vi.fn(() => Promise.resolve()),
  elegirEmpresa: vi.fn(() => Promise.resolve()),
  cambiarEmpresa: vi.fn(() => Promise.resolve()),
  abrirSesionDeInvitacion: vi.fn(() => Promise.resolve()),
  regresarSinCambiar: vi.fn(),
  refrescarEmpresas: vi.fn(() => Promise.resolve()),
  volverAlInicio: vi.fn(),
  cerrarSesion: vi.fn(),
  reintentarContexto: vi.fn(),
  consumirFin: vi.fn(),
};

function Entorno({
  router,
  estado,
}: {
  router: ReturnType<typeof createMemoryRouter>;
  estado: SessionState;
}) {
  const contenido = <RouterProvider router={router} />;
  return (
    <QueryClientProvider client={crearQueryClient()}>
      <ThemeProvider>
        <SessionStateProvider estado={estado} acciones={ACCIONES}>
          {contenido}
        </SessionStateProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Sin `estado` la sesión está lista (`SESION_LISTA`). */
function renderizar(
  ruta: string,
  tabla: RouteObject[] = rutas,
  estado: SessionState = SESION_LISTA,
) {
  const router = createMemoryRouter(tabla, { initialEntries: [ruta] });
  render(<Entorno router={router} estado={estado} />);
  return router;
}

/** El anuncio del cambio de página: la región de estado fuera de `main`. */
function anuncioDeRuta(): HTMLElement {
  const fuera = screen
    .getAllByRole('status')
    .filter((region) => region.closest('main') === null);
  expect(fuera).toHaveLength(1);
  return fuera[0] as HTMLElement;
}

describe('tabla de rutas', () => {
  it('/bandeja muestra la pantalla real con su título y subtítulo', () => {
    renderizar('/bandeja');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja de revisión' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Movimientos abiertos, del monto más alto al más bajo'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pantalla en construcción/)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('/cargas muestra la pantalla real con su título y subtítulo', () => {
    renderizar('/cargas');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sube CFDI y estados de cuenta. El motor corre al terminar cada carga.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pantalla en construcción/)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('/bitacora muestra su pantalla dentro del layout, ya no el marcador', () => {
    renderizar('/bitacora');
    const filtros = screen.getByRole('form', {
      name: 'Filtros de la bitácora',
    });
    expect(screen.getByRole('main')).toContainElement(filtros);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bitácora' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Quién hizo qué y cuándo. Solo lectura, nadie la edita.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pantalla en construcción/)).toBeNull();
  });

  it('/tolerancia muestra su pantalla dentro del layout, ya no el marcador', () => {
    renderizar('/tolerancia');
    const h2 = screen.getByRole('heading', { level: 2, name: 'Valor actual' });
    expect(screen.getByRole('main')).toContainElement(h2);
    expect(screen.queryByText(/Pantalla en construcción/)).toBeNull();
  });

  it.each(['/bandeja', '/casos/abc', '/cargas', '/tolerancia', '/bitacora'])(
    '%s dentro del shell tiene un banner, una navegación y un main',
    (ruta) => {
      renderizar(ruta);
      expect(screen.getAllByRole('banner')).toHaveLength(1);
      expect(screen.getAllByRole('navigation')).toHaveLength(1);
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it('en /tolerancia el h1 del encabezado precede al h2 de la pantalla', () => {
    renderizar('/tolerancia');
    const h1 = screen.getByRole('heading', {
      level: 1,
      name: 'Tolerancia de monto',
    });
    const h2 = screen.getByRole('heading', { level: 2, name: 'Valor actual' });
    expect(
      h1.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('en /cargas el h1 del encabezado precede a los h2 de la pantalla', () => {
    renderizar('/cargas');
    const h1 = screen.getByRole('heading', { level: 1, name: 'Cargas' });
    for (const nombre of ['CFDI · XML', 'Estado de cuenta']) {
      const h2 = screen.getByRole('heading', { level: 2, name: nombre });
      expect(
        h1.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it.each([
    ['/login', 'Inicia sesión'],
    ['/empresa', 'Elige empresa'],
  ])('%s se muestra fuera del shell con su propio main', (ruta, nombre) => {
    renderizar(
      ruta,
      rutas,
      ruta === '/login' ? ESTADOS.anonymous : ESTADOS.selectingLogin,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: nombre }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('/casos/:movimientoId carga el caso dentro del layout', async () => {
    renderizar('/casos/abc');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Detalle del caso' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cargando caso')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByText('Cargando caso'),
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText('Cargando caso')).toBeNull());
  });

  it('/casos/:movimientoId no interpreta el id como marcado', async () => {
    renderizar('/casos/%3Cb%3Ex%3C%2Fb%3E');
    await waitFor(() => expect(screen.queryByText('Cargando caso')).toBeNull());
    // El id nunca llega al DOM: ni como texto ni como un elemento inyectado.
    expect(document.body.querySelector('b')).toBeNull();
    expect(document.body.innerHTML).not.toContain('<b>');
    expect(document.body.textContent).not.toContain('x</b>');
  });

  it('/ redirige a /bandeja', () => {
    const router = renderizar('/');
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja de revisión' }),
    ).toBeInTheDocument();
  });

  it('una ruta desconocida muestra la vista de no encontrada', () => {
    renderizar('/nada');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('cada ruta aporta un solo main', () => {
    for (const ruta of ['/bandeja', '/casos/1', '/nada']) {
      const { unmount } = render(
        <Entorno
          router={createMemoryRouter(rutas, { initialEntries: [ruta] })}
          estado={SESION_LISTA}
        />,
      );
      expect(screen.getAllByRole('main')).toHaveLength(1);
      unmount();
    }
  });
});

describe('guardas en el árbol de rutas', () => {
  const hijos = rutas[0]?.children ?? [];

  it('envuelve /login, /empresa y el shell, y deja libres la galería y no encontrada', () => {
    const guardada = (ruta: string) =>
      hijos.some((h) => h.children?.some((c) => c.path === ruta));
    expect(guardada('/login')).toBe(true);
    expect(guardada('/empresa')).toBe(true);
    expect(hijos.some((h) => h.path === '*')).toBe(true);
    expect(hijos.some((h) => h.path === '/__kit')).toBe(true);
    const protegida = hijos.find((h) =>
      h.children?.some((c) => c.children?.some((n) => n.path === '/bandeja')),
    );
    expect(protegida?.children?.[0]?.children?.map((n) => n.path)).toEqual([
      '/bandeja',
      '/casos/:movimientoId',
      '/cargas',
      '/tolerancia',
      '/bitacora',
      '/usuarios',
    ]);
  });

  it('/recuperar y /recuperar/:token son públicas: ninguna guarda las envuelve', () => {
    const libre = (ruta: string) => hijos.some((h) => h.path === ruta);
    expect(libre('/recuperar')).toBe(true);
    expect(libre('/recuperar/:token')).toBe(true);
  });

  it('con sesión, /recuperar no redirige', async () => {
    const router = renderizar('/recuperar');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe('/recuperar');
  });

  it('sin sesión, una pantalla interna lleva a /login y la dirección es solo /login', () => {
    const router = renderizar('/casos/9?x=1#y', rutas, ESTADOS.anonymous);
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
    expect(router.state.location.hash).toBe('');
    expect(router.state.location.state).toEqual({
      from: { pathname: '/casos/9', search: '?x=1', hash: '#y' },
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('tras expirar, /login recuerda el destino; tras cerrar sesión, no', () => {
    const expirada = renderizar('/cargas', rutas, terminada('sesion_expirada'));
    expect(expirada.state.location.state).toEqual({
      from: { pathname: '/cargas' },
    });
    const cerrada = renderizar(
      '/cargas',
      rutas,
      terminada('cierre_voluntario'),
    );
    expect(cerrada.state.location.state).toBeNull();
  });

  it('con sesión, /login y /empresa llevan a /bandeja', () => {
    expect(renderizar('/login').state.location.pathname).toBe('/bandeja');
    expect(renderizar('/empresa').state.location.pathname).toBe('/bandeja');
  });

  it('eligiendo empresa, el shell lleva a /empresa', () => {
    const router = renderizar('/bandeja', rutas, ESTADOS.selectingLogin);
    expect(router.state.location.pathname).toBe('/empresa');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Elige empresa' }),
    ).toBeInTheDocument();
  });

  it.each<[string, SessionState]>([
    ['anonymous', ESTADOS.anonymous],
    ['selecting', ESTADOS.selectingLogin],
    ['loading', ESTADOS.loading],
    ['unavailable', ESTADOS.unavailable],
    ['ready', ESTADOS.ready],
    ['ended', terminada('sesion_expirada')],
  ])(
    '%s: una ruta desconocida es no encontrada y no redirige',
    (_n, estado) => {
      const router = renderizar('/nada', rutas, estado);
      expect(router.state.location.pathname).toBe('/nada');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
      ).toBeInTheDocument();
    },
  );

  it('la galería no pasa por ninguna guarda', async () => {
    const router = renderizar('/__kit', rutas, ESTADOS.anonymous);
    expect(
      // La galería se carga con `import()` diferido y arrastra los módulos de
      // todas las pantallas: la primera importación en el worker es lenta
      // bajo carga de CPU, aunque la ruta funcione.
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Galería de componentes' },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/__kit');
  });
});

describe('mundo de plataforma en el árbol de rutas', () => {
  const hijos = rutas[0]?.children ?? [];

  it('envuelve /plataforma/login y /plataforma en un proveedor de sesión propio', () => {
    const capa = hijos.find((h) =>
      h.children?.some((c) =>
        c.children?.some((n) => n.path === '/plataforma'),
      ),
    );
    expect(capa).toBeDefined();
    expect(capa?.path).toBeUndefined();
    const rutasDeCapa = capa?.children?.flatMap((c) =>
      (c.children ?? []).map((n) => n.path),
    );
    expect(rutasDeCapa).toEqual(['/plataforma/login', '/plataforma']);
  });

  it('con la cookie de plataforma, una ruta de empresa lleva a /login y no consulta /plataforma', async () => {
    // El backend responde 403 a `GET /auth/contexto` con una sesión de otro
    // tipo: la sesión de empresa termina como `sin_acceso`.
    contextoFalla(403);
    const espia = espiarSolicitudes();
    const { router } = montarApp('/bandeja');
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(
      espia.solicitudes.filter((s) => s.ruta.startsWith('/api/plataforma/')),
    ).toEqual([]);
    espia.detener();
  });

  it('una pantalla interna de plataforma no pasa por la guarda de empresa', async () => {
    usarHandlersPlataforma();
    sesionPlataformaAbierta();
    const { router } = montarApp('/plataforma');
    await screen.findByRole('heading', { level: 1, name: 'Empresas' });
    expect(router.state.location.pathname).toBe('/plataforma');
  });
});

describe('título y anuncio del cambio de página', () => {
  it('pone el título del documento y lo anuncia', async () => {
    renderizar('/cargas');
    await waitFor(() => expect(document.title).toBe('Cargas · Cuadra'));
    // La pantalla de cargas ya trae sus propias regiones de estado (esqueleto
    // del historial): el anuncio de ruta es el que queda fuera de `main`.
    expect(anuncioDeRuta()).toHaveTextContent('Cargas');
  });

  it('actualiza ambos al navegar', async () => {
    const router = renderizar('/bandeja');
    await waitFor(() =>
      expect(document.title).toBe('Bandeja de revisión · Cuadra'),
    );
    await act(() => router.navigate('/casos/7'));
    await waitFor(() =>
      expect(document.title).toBe('Detalle del caso · Cuadra'),
    );
    // El detalle suma su propia región de espera dentro de main; el anuncio
    // del cambio de página es la única región de estado fuera de él.
    expect(anuncioDeRuta()).toHaveTextContent(/^Detalle del caso$/);
  });

  it('la región de anuncio no es un landmark', () => {
    renderizar('/bandeja');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });
});

describe('galería /__kit', () => {
  it('está registrada en desarrollo', () => {
    const rutaKit = rutas[0]?.children?.find((r) => r.path === '/__kit');
    expect(rutaKit).toBeDefined();
  });

  it('no existe cuando DEV es falso y cae en no encontrada', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();
    try {
      const { rutas: rutasProduccion } = await import('./router');
      expect(
        rutasProduccion[0]?.children?.some((r) => r.path === '/__kit'),
      ).toBe(false);
      // Tras resetModules, router y react-router son instancias nuevas: el
      // proveedor debe salir de la misma instancia que las rutas.
      const rr = await import('react-router');
      const router = rr.createMemoryRouter(rutasProduccion, {
        initialEntries: ['/__kit'],
      });
      render(<rr.RouterProvider router={router} />);
      expect(
        screen.getByRole('heading', { name: 'Página no encontrada' }),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
