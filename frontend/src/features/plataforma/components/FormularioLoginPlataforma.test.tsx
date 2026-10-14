import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormularioLoginPlataforma } from './FormularioLoginPlataforma';

function montar() {
  const onEnviar = vi.fn();
  render(
    <FormularioLoginPlataforma
      pendiente={false}
      fallo={null}
      onEnviar={onEnviar}
    />,
  );
  return { onEnviar };
}

const clave = () => screen.getByLabelText('Contraseña');

describe('FormularioLoginPlataforma: mostrar y ocultar la contraseña', () => {
  it('empieza oculta con «Mostrar» y mantiene current-password', () => {
    montar();
    expect(clave()).toHaveAttribute('type', 'password');
    expect(clave()).toHaveAttribute('autocomplete', 'current-password');
    const boton = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(boton).toHaveTextContent('Mostrar');
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(boton).toHaveAttribute('aria-controls', clave().id);
  });

  it('alterna entre mostrar y ocultar', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    expect(clave()).toHaveAttribute('type', 'text');
    const ocultar = screen.getByRole('button', { name: 'Ocultar contraseña' });
    expect(ocultar).toHaveTextContent('Ocultar');
    expect(ocultar).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(ocultar);
    expect(clave()).toHaveAttribute('type', 'password');
  });

  it('se alcanza con teclado tras la contraseña', async () => {
    const usuario = userEvent.setup();
    montar();
    clave().focus();
    await usuario.tab();
    expect(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    ).toHaveFocus();
  });

  it('el envío sigue mandando lo escrito', async () => {
    const usuario = userEvent.setup();
    const { onEnviar } = montar();
    await usuario.type(screen.getByLabelText('Correo'), 'dueno@cuadra.mx');
    await usuario.type(clave(), 'Cuadra-2026');
    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(onEnviar).toHaveBeenCalledWith({
        email: 'dueno@cuadra.mx',
        password: 'Cuadra-2026',
      }),
    );
  });
});
