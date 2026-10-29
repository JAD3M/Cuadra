import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoLecturaPdf } from './ResultadoLecturaPdf';

const LECTURA = {
  movimientosLeidos: 14,
  saldoInicial: '10000.00',
  saldoFinal: '11250.50',
  estado: 'pendiente_vista_previa',
} as const;

describe('ResultadoLecturaPdf (PDF guardado, historia 3.3)', () => {
  it('dice cuántos movimientos se leyeron y que los saldos cuadran', () => {
    const { container } = render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(container).toHaveTextContent(
      '14 movimientos leídos. Los saldos cuadran.',
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

  it('lleva el chip con el estado del servidor y la pista de que están en espera', () => {
    render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(screen.getByText('Pendiente de vista previa')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los movimientos quedan en espera: todavía no entran a conciliación.',
      ),
    ).toBeInTheDocument();
  });

  it('no hay advertencia de líneas no leídas: un PDF guardado no las tiene', () => {
    render(<ResultadoLecturaPdf {...LECTURA} />);
    expect(screen.queryByText('⚠')).not.toBeInTheDocument();
    expect(screen.queryByText(/líneas no leídas/)).not.toBeInTheDocument();
  });
});
