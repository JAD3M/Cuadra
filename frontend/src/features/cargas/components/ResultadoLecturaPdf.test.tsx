import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoLecturaPdf } from './ResultadoLecturaPdf';

const LECTURA = {
  movimientosLeidos: 14,
  lineasNoLeidas: 2,
  saldoInicial: '10000.00',
  saldoFinal: '11250.50',
};

describe('ResultadoLecturaPdf', () => {
  it('resume los conteos con el texto del mockup', () => {
    const { container } = render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(container.querySelector('p')).toHaveTextContent(
      '14 movimientos leídos, 2 líneas no leídas.',
    );
  });

  it('muestra los saldos con formato, sin signo de peso', () => {
    render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(screen.getByText('Saldo inicial')).toBeInTheDocument();
    expect(screen.getByText('Saldo final')).toBeInTheDocument();
    expect(screen.getByText('10,000.00')).toBeInTheDocument();
    expect(screen.getByText('11,250.50')).toBeInTheDocument();
  });

  it('un saldo grande conserva todos sus dígitos (nunca pasa por flotante)', () => {
    render(
      <ResultadoLecturaPdf
        {...LECTURA}
        saldoInicial="12345678901234567.89"
        saldoFinal="-0.10"
      />,
    );
    expect(screen.getByText('12,345,678,901,234,567.89')).toBeInTheDocument();
    expect(screen.getByText('−0.10')).toBeInTheDocument();
  });

  it('con líneas no leídas aparece la marca de advertencia', () => {
    render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(screen.getByText('⚠')).toBeInTheDocument();
    expect(screen.getAllByText(/líneas no leídas/)).toHaveLength(2);
  });

  it('sin líneas no leídas no hay marca de advertencia', () => {
    const { container } = render(
      <ResultadoLecturaPdf {...LECTURA} lineasNoLeidas={0} />,
    );
    expect(screen.queryByText('⚠')).not.toBeInTheDocument();
    expect(container.querySelector('p')).toHaveTextContent(
      '14 movimientos leídos, 0 líneas no leídas.',
    );
    expect(screen.getAllByText(/líneas no leídas/)).toHaveLength(1);
  });
});
