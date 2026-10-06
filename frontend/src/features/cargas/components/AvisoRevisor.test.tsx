import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoRevisor } from './AvisoRevisor';

describe('AvisoRevisor', () => {
  it('es una región de estado con el texto de solo lectura', () => {
    render(<AvisoRevisor />);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent(
      'Tu rol solo permite consultar las cargas.',
    );
    expect(aviso).toHaveTextContent(
      'Pide a un administrador o contador que suba los archivos.',
    );
  });

  it('el icono es decorativo', () => {
    render(<AvisoRevisor />);
    expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
