import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoSoloAdmin } from './AvisoSoloAdmin';

describe('AvisoSoloAdmin', () => {
  it('es una nota con el texto exacto (TOL-8.2)', () => {
    render(<AvisoSoloAdmin />);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Solo un administrador de la empresa puede cambiar la tolerancia.',
    );
  });

  it('el candado es decorativo', () => {
    render(<AvisoSoloAdmin />);
    expect(screen.getByRole('note').querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('no ofrece ningún control', () => {
    render(<AvisoSoloAdmin />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
