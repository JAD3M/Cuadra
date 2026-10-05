import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlertaError } from './AlertaError';

describe('AlertaError', () => {
  it('es una alerta con título', () => {
    render(<AlertaError titulo="Correo o contraseña incorrectos" />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Correo o contraseña incorrectos');
  });

  it('muestra el detalle solo cuando se da', () => {
    const { rerender } = render(<AlertaError titulo="Falló" />);
    expect(screen.queryByText('Revisa tus datos')).not.toBeInTheDocument();
    rerender(<AlertaError titulo="Falló" detalle="Revisa tus datos" />);
    expect(screen.getByText('Revisa tus datos')).toBeInTheDocument();
  });

  it('se puede enfocar desde código pero no está en el orden de tabulación', () => {
    const ref = createRef<HTMLDivElement>();
    render(<AlertaError titulo="Falló" ref={ref} />);
    expect(screen.getByRole('alert')).toHaveAttribute('tabindex', '-1');
    ref.current?.focus();
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('acepta un id para enlazarla con aria-describedby', () => {
    render(<AlertaError titulo="Falló" id="fallo-login" />);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'fallo-login');
  });

  it('el icono es decorativo', () => {
    const { container } = render(<AlertaError titulo="Falló" />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
