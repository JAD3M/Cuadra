import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoAuth } from './AvisoAuth';

describe('AvisoAuth', () => {
  it('es un estado con su texto', () => {
    render(<AvisoAuth>Cerraste sesión.</AvisoAuth>);
    expect(screen.getByRole('status')).toHaveTextContent('Cerraste sesión.');
  });

  it('es enfocable por código y no entra en la tabulación', () => {
    render(<AvisoAuth>Cerraste sesión.</AvisoAuth>);
    expect(screen.getByRole('status')).toHaveAttribute('tabindex', '-1');
  });

  it('no roba el foco si no se pide', () => {
    render(<AvisoAuth>Cerraste sesión.</AvisoAuth>);
    expect(screen.getByRole('status')).not.toHaveFocus();
  });

  it('toma el foco al montarse cuando se pide', () => {
    render(<AvisoAuth enfocar>Cerraste sesión.</AvisoAuth>);
    expect(screen.getByRole('status')).toHaveFocus();
  });
});
