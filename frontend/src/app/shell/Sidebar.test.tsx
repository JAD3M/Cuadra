import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ETIQUETAS_ROL, type Rol } from '@/shared/dominio';
import { Sidebar } from './Sidebar';

function dibujar(
  ruta: string,
  opciones: {
    pendientes?: number;
    roles?: Rol[];
    onCerrarSesion?: () => void;
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Sidebar
        rutaActual={ruta}
        pendientes={opciones.pendientes}
        usuario={{ nombre: 'Luis Reyes' }}
        roles={opciones.roles ?? ['contador']}
        controlTema={<div data-testid="control-tema">tema</div>}
        onCerrarSesion={opciones.onCerrarSesion}
      />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('expone la navegación principal con sus cuatro enlaces', () => {
    dibujar('/bandeja');
    const nav = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    const enlaces = within(nav).getAllByRole('link');
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual([
      '/bandeja',
      '/cargas',
      '/bitacora',
      '/tolerancia',
    ]);
  });

  it('marca como actual solo el enlace de la ruta', () => {
    dibujar('/cargas');
    const actuales = screen
      .getAllByRole('link')
      .filter((e) => e.getAttribute('aria-current') === 'page');
    expect(actuales).toHaveLength(1);
    expect(actuales[0]).toHaveTextContent('Cargas');
  });

  it('mantiene Bandeja como actual en /casos/:id', () => {
    dibujar('/casos/abc');
    expect(screen.getByRole('link', { name: 'Bandeja' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Cargas' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('sin ruta reconocida no hay enlace actual', () => {
    dibujar('/login');
    for (const enlace of screen.getAllByRole('link')) {
      expect(enlace).not.toHaveAttribute('aria-current');
    }
  });

  it('muestra el contador con nombre accesible', () => {
    dibujar('/bandeja', { pendientes: 12 });
    const enlace = screen.getByRole('link', { name: 'Bandeja 12 pendientes' });
    expect(enlace).toHaveTextContent('12');
  });

  it('usa singular con un pendiente', () => {
    dibujar('/bandeja', { pendientes: 1 });
    expect(
      screen.getByRole('link', { name: 'Bandeja 1 pendiente' }),
    ).toBeInTheDocument();
  });

  it('omite el contador cuando no hay dato', () => {
    dibujar('/bandeja');
    expect(screen.getByRole('link', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.queryByText(/pendiente/)).toBeNull();
  });

  it('dibuja el control de tema justo encima del bloque de usuario', () => {
    dibujar('/bandeja');
    const control = screen.getByTestId('control-tema');
    const usuario = screen.getByText('Luis Reyes').parentElement;
    expect(control.nextElementSibling).toBe(usuario);
  });

  it('los iconos son decorativos', () => {
    const { container } = dibujar('/bandeja');
    const iconos = container.querySelectorAll('nav svg');
    expect(iconos).toHaveLength(4);
    for (const icono of iconos) {
      expect(icono).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('los enlaces se alcanzan con el teclado en orden', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    dibujar('/bandeja');
    const usuario = userEvent.setup();
    await usuario.tab();
    expect(screen.getByRole('link', { name: 'Bandeja' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('link', { name: 'Cargas' })).toHaveFocus();
  });

  it('muestra el usuario con la etiqueta del rol', () => {
    dibujar('/bandeja', { roles: ['contador'] });
    expect(screen.getByText(ETIQUETAS_ROL.contador)).toBeInTheDocument();
  });

  it('sin onCerrarSesion no dibuja el botón', () => {
    dibujar('/bandeja');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  it('reenvía «Cerrar sesión» desde el bloque de usuario, después del tema', async () => {
    const onCerrarSesion = vi.fn();
    dibujar('/bandeja', { onCerrarSesion });
    const barra = screen.getByRole('complementary', { name: 'Barra lateral' });
    const boton = within(barra).getByRole('button', { name: 'Cerrar sesión' });
    expect(
      screen.getByTestId('control-tema').compareDocumentPosition(boton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(boton);
    expect(onCerrarSesion).toHaveBeenCalledOnce();
  });
});
