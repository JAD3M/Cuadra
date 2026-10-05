import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearMatchMediaFalso } from '@/test/fixturesTema';
import { ControlTema, ThemeProvider } from '@/shared/tema';
import { LayoutAuth } from './LayoutAuth';

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = crearMatchMediaFalso(true).matchMedia;
});

function montar() {
  return render(
    <ThemeProvider>
      <LayoutAuth controlTema={<ControlTema />}>
        <h1>Inicia sesión</h1>
        <input aria-label="Correo" />
      </LayoutAuth>
    </ThemeProvider>,
  );
}

describe('LayoutAuth', () => {
  it('tiene un solo main', () => {
    montar();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('puede renderizarse como div para no repetir el landmark', () => {
    const { container } = render(
      <LayoutAuth como="div" controlTema={null}>
        Contenido
      </LayoutAuth>,
    );
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('muestra el panel de marca y el contenido', () => {
    montar();
    expect(
      screen.getByText('Cada peso del banco, con su CFDI.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
  });

  it('el panel de marca no aporta encabezados: queda un solo h1', () => {
    montar();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('el control de tema ofrece Claro, Sistema y Oscuro', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Tema' });
    const opciones = within(grupo).getAllByRole('radio');
    for (const nombre of ['Claro', 'Sistema', 'Oscuro']) {
      expect(
        within(grupo).getByRole('radio', { name: nombre }),
      ).toBeInTheDocument();
    }
    expect(opciones).toHaveLength(3);
  });

  it('el control de tema es lo primero que se alcanza con el teclado', async () => {
    montar();
    await userEvent.tab();
    const grupo = screen.getByRole('group', { name: 'Tema' });
    expect(grupo).toContainElement(document.activeElement as HTMLElement);
    // Los radios son un solo punto de tabulación: el siguiente es el campo.
    await userEvent.tab();
    expect(screen.getByLabelText('Correo')).toHaveFocus();
  });
});
