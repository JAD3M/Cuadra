import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@/shared/tema';
import { RutaKit } from './RutaKit';

function renderizar() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/__kit']}>
        <RutaKit />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('RutaKit (galería de componentes)', () => {
  it('muestra el título de la galería', () => {
    renderizar();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Galería de componentes' }),
    ).toBeVisible();
  });

  it('tiene un solo main y el header de la muestra queda dentro de él', () => {
    renderizar();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    // Testing Library no aplica el contexto: un header dentro de main no es
    // banner según HTML-AAM, así que basta comprobar que está anidado en él.
    const main = screen.getByRole('main');
    for (const encabezado of screen.queryAllByRole('banner')) {
      expect(main).toContainElement(encabezado);
    }
  });

  it('cada sección tiene su encabezado', () => {
    renderizar();
    const secciones = [
      'Tema',
      'Botones',
      'Campos y alertas',
      'Pantalla de acceso',
      'Formulario de acceso',
      'Elección de empresa',
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

  it('la galería de acceso no repite el main ni los encabezados de la página', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Pantalla de acceso' });
    expect(within(seccion).queryByRole('main')).not.toBeInTheDocument();
    expect(within(seccion).getAllByRole('status')).toHaveLength(2);
    expect(
      within(seccion).getByText('Cada peso del banco, con su CFDI.'),
    ).toBeInTheDocument();
  });

  it('la galería del formulario de acceso muestra sus estados sin un segundo h1', () => {
    renderizar();
    const seccion = screen.getByRole('region', {
      name: 'Formulario de acceso',
    });
    expect(within(seccion).getAllByRole('form')).toHaveLength(4);
    expect(within(seccion).queryByRole('heading', { level: 1 })).toBeNull();
    expect(within(seccion).getAllByRole('alert')).toHaveLength(2);
    expect(
      within(seccion).getByRole('button', { name: 'Entrando…' }),
    ).toBeDisabled();
    expect(document.body).toHaveFocus();
  });

  it('la galería de empresas muestra la lista en reposo, en curso y con una sola', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Elección de empresa' });
    expect(within(seccion).getAllByRole('list')).toHaveLength(3);
    expect(within(seccion).getAllByRole('button')).toHaveLength(7);
    expect(within(seccion).getByText('Entrando…')).toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('la galería de campos muestra un campo con error y una alerta', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Campos y alertas' });
    expect(within(seccion).getByLabelText('Correo con error')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(within(seccion).getByRole('alert')).toBeInTheDocument();
  });

  it('muestra los botones deshabilitados', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Botones' });
    expect(
      within(seccion)
        .getAllByRole('button')
        .filter((b) => (b as HTMLButtonElement).disabled),
    ).toHaveLength(6);
  });

  it('muestra los seis tonos de chip', () => {
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Chips de estado' });
    expect(within(seccion).getAllByRole('listitem')).toHaveLength(6);
  });

  it('formatea montos grande, negativo e inválido', () => {
    renderizar();
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
    renderizar();
    const seccion = screen.getByRole('region', { name: 'Tema' });
    await userEvent.setup().click(within(seccion).getByLabelText(/Claro/));
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.setup().click(within(seccion).getByLabelText(/Oscuro/));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ensambla la barra lateral, el usuario y la insignia de empresa', () => {
    renderizar();
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

  it('marca Bandeja como activa en la muestra del shell', () => {
    renderizar();
    const nav = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    expect(within(nav).getByRole('link', { name: /Bandeja/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: 'Cargas' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('no monta un router propio: usa el que la rodea', () => {
    // Sin router alrededor, los enlaces de la muestra no pueden renderizar.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ThemeProvider>
          <RutaKit />
        </ThemeProvider>,
      ),
    ).toThrow();
    error.mockRestore();
  });
});
