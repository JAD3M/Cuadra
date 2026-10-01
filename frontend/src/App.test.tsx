import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App (galería temporal)', () => {
  it('smoke: App renders', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Galería de componentes' }),
    ).toBeVisible();
  });

  it('tiene un solo main y el header de la muestra queda dentro de él', () => {
    render(<App />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // Testing Library no aplica el contexto: un header dentro de main no es
    // banner según HTML-AAM, así que basta comprobar que está anidado en él.
    const main = screen.getByRole('main');
    for (const encabezado of screen.queryAllByRole('banner')) {
      expect(main).toContainElement(encabezado);
    }
  });

  it('cada sección tiene su encabezado', () => {
    render(<App />);
    const secciones = [
      'Tema',
      'Botones',
      'Tarjetas',
      'Chips de estado',
      'Tabla con montos',
      'Piezas del shell',
    ];
    for (const nombre of secciones) {
      expect(
        screen.getByRole('heading', { level: 2, name: nombre }),
      ).toBeInTheDocument();
    }
  });

  it('muestra los botones deshabilitados', () => {
    render(<App />);
    const seccion = screen.getByRole('region', { name: 'Botones' });
    expect(
      within(seccion)
        .getAllByRole('button')
        .filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(6);
  });

  it('muestra los seis tonos de chip', () => {
    render(<App />);
    const seccion = screen.getByRole('region', { name: 'Chips de estado' });
    expect(within(seccion).getAllByRole('listitem')).toHaveLength(6);
  });

  it('formatea montos grande, negativo e inválido', () => {
    render(<App />);
    const tabla = screen.getByRole('table', { name: 'Movimientos de ejemplo' });
    expect(within(tabla).getByText('$18,450.00')).toBeInTheDocument();
    expect(
      within(tabla).getByText('−$1,234,567,890,123.45'),
    ).toBeInTheDocument();
    expect(
      within(tabla).getByText('$12,345,678,901,234,567,890.12'),
    ).toBeInTheDocument();
    expect(within(tabla).getByText('Monto no disponible')).toBeInTheDocument();
  });

  it('el control de tema cambia el tema del documento', async () => {
    render(<App />);
    const seccion = screen.getByRole('region', { name: 'Tema' });
    await userEvent.setup().click(within(seccion).getByLabelText(/Claro/));
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.setup().click(within(seccion).getByLabelText(/Oscuro/));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ensambla la barra lateral, el usuario y la insignia de empresa', () => {
    render(<App />);
    const seccion = screen.getByRole('region', { name: 'Piezas del shell' });
    expect(
      within(seccion).getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
    expect(
      within(seccion).getByRole('link', { name: /Bandeja/ }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(seccion).getByText('Administrador, Revisor'),
    ).toBeInTheDocument();
    expect(within(seccion).getByText('FDB190215QK4')).toBeInTheDocument();
    expect(
      within(seccion).getByRole('region', { name: 'Contenido de ejemplo' }),
    ).toBeInTheDocument();
  });

  it('navegar en la muestra cambia el enlace activo', async () => {
    render(<App />);
    const nav = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    await userEvent
      .setup()
      .click(within(nav).getByRole('link', { name: 'Cargas' }));
    expect(within(nav).getByRole('link', { name: 'Cargas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
