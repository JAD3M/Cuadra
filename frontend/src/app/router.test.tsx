import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '@/shared/api';
import { ThemeProvider } from '@/shared/tema';
import {
  PlaceholderSessionProvider,
  SessionStateProvider,
  type AccionesSesion,
  type SessionState,
} from '@/shared/sesion';
import { ESTADOS, terminada } from '@/test/montarRutas';
import { rutas } from './router';

/** Acciones inertas: la pantalla de acceso las exige, estas pruebas no las usan. */
const ACCIONES: AccionesSesion = {
  iniciarSesion: vi.fn(() => Promise.resolve()),
  elegirEmpresa: vi.fn(() => Promise.resolve()),
  cambiarEmpresa: vi.fn(() => Promise.resolve()),
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
  estado?: SessionState;
}) {
  const contenido = <RouterProvider router={router} />;
  return (
    <QueryClientProvider client={crearQueryClient()}>
      <ThemeProvider>
        {estado ? (
          <SessionStateProvider estado={estado} acciones={ACCIONES}>
            {contenido}
          </SessionStateProvider>
        ) : (
          <PlaceholderSessionProvider>{contenido}</PlaceholderSessionProvider>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Sin `estado` usa el proveedor provisional, que siempre está `ready`. */
function renderizar(
  ruta: string,
  tabla: RouteObject[] = rutas,
  estado?: SessionState,
) {
  const router = createMemoryRouter(tabla, { initialEntries: [ruta] });
  render(<Entorno router={router} estado={estado} />);
  return router;
}

describe('tabla de rutas', () => {
  it.each([
    ['/bandeja', 'Bandeja'],
    ['/cargas', 'Cargas'],
    ['/tolerancia', 'Tolerancia'],
    ['/bitacora', 'Bitácora'],
  ])('%s muestra su marcador dentro del layout', (ruta, nombre) => {
    renderizar(ruta);
    expect(
      screen.getByRole('heading', { level: 2, name: nombre }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pantalla en construcción/)).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 2, name: nombre }),
    );
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

  it('el h1 del encabezado precede al h2 del marcador', () => {
    renderizar('/cargas');
    const h1 = screen.getByRole('heading', { level: 1, name: 'Cargas' });
    const h2 = screen.getByRole('heading', { level: 2, name: 'Cargas' });
    expect(
      h1.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it('/casos/abc muestra el id de la ruta dentro del layout', () => {
    renderizar('/casos/abc');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Detalle del caso' }),
    ).toBeInTheDocument();
    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByText('abc'));
  });

  it('/casos/:id no interpreta el id como marcado', () => {
    renderizar('/casos/%3Cb%3Ex%3C%2Fb%3E');
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
    expect(document.querySelector('main b')).toBeNull();
  });

  it('/ redirige a /bandeja', () => {
    const router = renderizar('/');
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Bandeja' }),
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
      '/casos/:id',
      '/cargas',
      '/tolerancia',
      '/bitacora',
    ]);
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
      await screen.findByRole('heading', {
        level: 1,
        name: 'Galería de componentes',
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/__kit');
  });
});

describe('título y anuncio del cambio de página', () => {
  it('pone el título del documento y lo anuncia', async () => {
    renderizar('/cargas');
    await waitFor(() => expect(document.title).toBe('Cargas · Cuadra'));
    expect(screen.getByRole('status')).toHaveTextContent('Cargas');
  });

  it('actualiza ambos al navegar', async () => {
    const router = renderizar('/bandeja');
    await waitFor(() => expect(document.title).toBe('Bandeja · Cuadra'));
    await router.navigate('/casos/7');
    await waitFor(() =>
      expect(document.title).toBe('Detalle del caso · Cuadra'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Detalle del caso');
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
