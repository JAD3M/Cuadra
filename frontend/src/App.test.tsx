import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { rutas } from './app/router';

function montar(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  return render(<App router={router} />);
}

describe('App', () => {
  it('monta en /bandeja sin errores', () => {
    const errores: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errores.push(args);
    try {
      montar('/bandeja');
      expect(
        screen.getByRole('heading', { level: 2, name: 'Bandeja' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(errores).toEqual([]);
    } finally {
      console.error = original;
    }
  });

  it('smoke: App renders (raíz redirige a /bandeja)', () => {
    montar('/');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja' }),
    ).toBeInTheDocument();
  });

  it('con la sesión provisional (siempre lista) /login lleva a /bandeja', () => {
    const router = createMemoryRouter(rutas, { initialEntries: ['/login'] });
    render(<App router={router} />);
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja' }),
    ).toBeInTheDocument();
  });

  it('aplica el tema por defecto del proveedor al montar', () => {
    montar('/bandeja');
    expect(document.documentElement.dataset.theme).toMatch(/^(light|dark)$/);
  });

  it('muestra la galería en /__kit cuando es desarrollo', async () => {
    montar('/__kit');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Galería de componentes',
      }),
    ).toBeInTheDocument();
  });
});
