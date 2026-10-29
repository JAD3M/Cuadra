import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetalleRechazoPdf } from './DetalleRechazoPdf';

afterEach(() => vi.restoreAllMocks());

describe('DetalleRechazoPdf', () => {
  it('pinta saldo final, saldo esperado y diferencia en el orden del mockup', () => {
    render(
      <DetalleRechazoPdf
        saldos={{
          saldoFinal: '11250.50',
          saldoEsperado: '11000',
          diferencia: '250.5',
        }}
        lineas={[]}
      />,
    );
    const rotulos = screen
      .getAllByRole('term')
      .map((termino) => termino.textContent);
    expect(rotulos).toEqual([
      'Saldo final del PDF',
      'Saldo esperado con los movimientos',
      'Diferencia',
    ]);
    expect(screen.getByText('11,250.50')).toBeInTheDocument();
  });

  it('pinta solo los montos que llegaron', () => {
    render(<DetalleRechazoPdf saldos={{ diferencia: '250.5' }} lineas={[]} />);
    expect(screen.getAllByRole('term')).toHaveLength(1);
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
  });

  it('dos líneas con el mismo número de línea no repiten key', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <DetalleRechazoPdf
        lineas={[
          { linea: 7, texto: 'primera' },
          { linea: 7, texto: 'segunda' },
        ]}
      />,
    );
    expect(screen.getByText('Línea 7 · primera')).toBeInTheDocument();
    expect(screen.getByText('Línea 7 · segunda')).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });
});
