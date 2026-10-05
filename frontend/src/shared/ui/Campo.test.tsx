import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Campo } from './Campo';

describe('Campo', () => {
  it('asocia la etiqueta con el control', () => {
    render(<Campo etiqueta="Correo" type="email" />);
    const control = screen.getByLabelText('Correo');
    expect(control.tagName).toBe('INPUT');
    expect(control).toHaveAttribute('type', 'email');
  });

  it('respeta el id recibido', () => {
    render(<Campo etiqueta="Correo" id="correo" />);
    expect(screen.getByLabelText('Correo')).toHaveAttribute('id', 'correo');
  });

  it('sin error no marca el control como inválido ni lo describe', () => {
    render(<Campo etiqueta="Correo" />);
    const control = screen.getByLabelText('Correo');
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).not.toHaveAttribute('aria-describedby');
  });

  it('con error lo marca inválido y lo enlaza con aria-describedby', () => {
    render(<Campo etiqueta="Correo" error="Escribe un correo válido" />);
    const control = screen.getByLabelText('Correo');
    const mensaje = screen.getByText('Escribe un correo válido');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', mensaje.id);
    expect(mensaje.id).not.toBe('');
  });

  it('suma la ayuda y lo que ya describía el control', () => {
    render(
      <Campo
        etiqueta="Contraseña"
        ayuda="Distingue mayúsculas"
        error="Escribe tu contraseña"
        aria-describedby="alerta-externa"
      />,
    );
    const ids = (
      screen.getByLabelText('Contraseña').getAttribute('aria-describedby') ?? ''
    ).split(' ');
    expect(ids).toEqual([
      'alerta-externa',
      screen.getByText('Distingue mayúsculas').id,
      screen.getByText('Escribe tu contraseña').id,
    ]);
  });

  it('reenvía la referencia al input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Campo etiqueta="Correo" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText('Correo'));
  });

  it('pasa el resto de atributos al input', () => {
    render(
      <Campo etiqueta="Correo" autoComplete="username" placeholder="a@b.mx" />,
    );
    const control = screen.getByLabelText('Correo');
    expect(control).toHaveAttribute('autocomplete', 'username');
    expect(control).toHaveAttribute('placeholder', 'a@b.mx');
  });

  it('dos campos no comparten ids', () => {
    render(
      <>
        <Campo etiqueta="Uno" error="Falla uno" />
        <Campo etiqueta="Dos" error="Falla dos" />
      </>,
    );
    expect(screen.getByText('Falla uno').id).not.toBe(
      screen.getByText('Falla dos').id,
    );
  });
});
