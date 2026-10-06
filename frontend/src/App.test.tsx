import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { rutas } from './app/router';

function montar(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  render(<App router={router} />);
  return router;
}

describe('App', () => {
  it('monta en /bandeja sin errores: sin sesión muestra el acceso', async () => {
    const errores: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errores.push(args);
    try {
      const router = montar('/bandeja');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(errores).toEqual([]);
    } finally {
      console.error = original;
    }
  });

  it('smoke: App renders (la raíz sin sesión termina en /login)', async () => {
    const router = montar('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('el destino pedido viaja en el estado del enrutador, no en la URL', async () => {
    const router = montar('/casos/9?x=1');
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/casos/9', search: '?x=1' },
    });
  });

  it('aplica el tema por defecto del proveedor al montar', () => {
    montar('/bandeja');
    expect(document.documentElement.dataset.theme).toMatch(/^(light|dark)$/);
  });

  it('muestra la galería en /__kit cuando es desarrollo', async () => {
    montar('/__kit');
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
  });
});
