import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoProcesando } from './ResultadoProcesando';

describe('ResultadoProcesando', () => {
  it('dice que la carga se procesa y muestra una barra indeterminada con ese nombre', () => {
    render(<ResultadoProcesando />);
    expect(screen.getByText('Procesando la carga…')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', {
      name: 'Procesando la carga…',
    });
    expect(barra).not.toHaveAttribute('aria-valuenow');
  });

  it('sin porcentaje ni número', () => {
    const { container } = render(<ResultadoProcesando />);
    expect(container).not.toHaveTextContent('%');
    expect(container).not.toHaveTextContent(/\d/);
  });

  it('no abre una región propia: la región del panel anuncia', () => {
    render(<ResultadoProcesando />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
