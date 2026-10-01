import { render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { rutas } from './router';

function renderizar(ruta: string, tabla: RouteObject[] = rutas) {
  const router = createMemoryRouter(tabla, { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
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
      screen.getByRole('heading', { name: nombre }),
    );
  });

  it.each([
    ['/login', 'Iniciar sesión'],
    ['/empresa', 'Elegir empresa'],
  ])('%s se muestra fuera del shell con su propio main', (ruta, nombre) => {
    renderizar(ruta);
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
      screen.getByRole('heading', { name: 'Detalle del caso' }),
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
      screen.getByRole('heading', { name: 'Bandeja' }),
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
    for (const ruta of ['/login', '/bandeja', '/casos/1', '/nada']) {
      const { unmount } = render(
        <RouterProvider
          router={createMemoryRouter(rutas, { initialEntries: [ruta] })}
        />,
      );
      expect(screen.getAllByRole('main')).toHaveLength(1);
      unmount();
    }
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
