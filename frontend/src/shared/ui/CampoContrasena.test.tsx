import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CampoContrasena } from './CampoContrasena';

const campo = () => screen.getByLabelText('Contraseña');

describe('CampoContrasena', () => {
  it('empieza oculta: type password y botón «Mostrar»', () => {
    render(<CampoContrasena etiqueta="Contraseña" />);
    expect(campo()).toHaveAttribute('type', 'password');
    const boton = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).toHaveTextContent('Mostrar');
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(boton).toHaveAttribute('aria-controls', campo().id);
  });

  it('al pulsar muestra el valor y el botón pasa a «Ocultar»', async () => {
    const usuario = userEvent.setup();
    render(<CampoContrasena etiqueta="Contraseña" />);
    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    expect(campo()).toHaveAttribute('type', 'text');
    const boton = screen.getByRole('button', { name: 'Ocultar contraseña' });
    expect(boton).toHaveTextContent('Ocultar');
    expect(boton).toHaveAttribute('aria-pressed', 'true');
  });

  it('al pulsar de nuevo vuelve a ocultar', async () => {
    const usuario = userEvent.setup();
    render(<CampoContrasena etiqueta="Contraseña" />);
    await usuario.click(screen.getByRole('button', { name: /contraseña/i }));
    await usuario.click(screen.getByRole('button', { name: /contraseña/i }));
    expect(campo()).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('se alcanza con teclado y se activa con Enter y espacio', async () => {
    const usuario = userEvent.setup();
    render(<CampoContrasena etiqueta="Contraseña" />);
    await usuario.tab();
    expect(campo()).toHaveFocus();
    await usuario.tab();
    const boton = screen.getByRole('button', { name: /contraseña/i });
    expect(boton).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(campo()).toHaveAttribute('type', 'text');
    await usuario.keyboard(' ');
    expect(campo()).toHaveAttribute('type', 'password');
  });

  it('conserva lo escrito y el resto de atributos al alternar', async () => {
    const usuario = userEvent.setup();
    render(
      <CampoContrasena etiqueta="Contraseña" autoComplete="current-password" />,
    );
    await usuario.type(campo(), 'secreta');
    await usuario.click(screen.getByRole('button', { name: /contraseña/i }));
    expect(campo()).toHaveValue('secreta');
    expect(campo()).toHaveAttribute('autocomplete', 'current-password');
  });
});
