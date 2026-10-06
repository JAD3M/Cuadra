import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BloqueMovimiento,
  type BloqueMovimientoProps,
} from './BloqueMovimiento';

const BASE: BloqueMovimientoProps = {
  fecha: '2026-09-16',
  descripcion: 'SPEI MATERIALES REYES',
  referencia: 'REF-9',
  monto: '18560.4000',
  moneda: 'MXN',
};

function dibujar(props: Partial<BloqueMovimientoProps> = {}) {
  return render(<BloqueMovimiento {...BASE} {...props} />);
}

describe('BloqueMovimiento', () => {
  it('es una sección con el título «Movimiento bancario»', () => {
    dibujar();
    const seccion = screen.getByRole('region', {
      name: 'Movimiento bancario',
    });
    expect(seccion).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Movimiento bancario' }),
    ).toBeInTheDocument();
  });

  it('muestra fecha, descripción y monto', () => {
    dibujar();
    expect(screen.getByText('2026-09-16')).toBeInTheDocument();
    expect(screen.getByText('SPEI MATERIALES REYES')).toBeInTheDocument();
    expect(screen.getByText('$18,560.40')).toBeInTheDocument();
  });

  it('la fecha no se corre por zona horaria (se separa por texto)', () => {
    dibujar({ fecha: '2026-01-01' });
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
  });

  it('la referencia solo se muestra cuando existe', () => {
    const { unmount } = dibujar({ referencia: 'REF-9' });
    expect(screen.getByText('REF-9')).toBeInTheDocument();
    expect(screen.queryByText('sin referencia')).toBeNull();
    unmount();
    dibujar({ referencia: null });
    expect(screen.queryByText(/REF-9/)).toBeNull();
    expect(screen.getByText('sin referencia')).toBeInTheDocument();
  });

  it('una moneda distinta de MXN va tras el monto, en un solo elemento', () => {
    dibujar({ monto: '2150.0000', moneda: 'USD' });
    const monto = screen.getByText('$2,150.00 USD');
    expect(monto.childNodes).toHaveLength(1);
  });

  it('MXN no repite el código dentro del monto', () => {
    dibujar({ monto: '2150.0000', moneda: 'MXN' });
    expect(screen.getByText('$2,150.00')).toBeInTheDocument();
    expect(screen.queryByText('$2,150.00 MXN')).toBeNull();
  });

  it('conserva la precisión de un monto de 16 dígitos', () => {
    dibujar({ monto: '9007199254740993.1200' });
    expect(screen.getByText('$9,007,199,254,740,993.12')).toBeInTheDocument();
  });

  it('un monto de 15 dígitos o más es un solo nodo de texto', () => {
    dibujar({ monto: '99999999999999.9999' });
    const monto = screen.getByText('$100,000,000,000,000.00');
    expect(monto.childNodes).toHaveLength(1);
    expect(monto.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
  });
});
