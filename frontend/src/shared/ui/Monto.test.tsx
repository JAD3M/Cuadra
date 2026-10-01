import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Monto } from './Monto';

describe('Monto', () => {
  it('muestra un monto normal formateado', () => {
    render(<Monto valor="18560.40" />);
    const monto = screen.getByText('$18,560.40');
    expect(monto).toHaveAttribute('data-estado', 'normal');
  });

  it('conserva la precisión con montos enormes', () => {
    render(<Monto valor="9007199254740993.12" />);
    expect(screen.getByText('$9,007,199,254,740,993.12')).toBeInTheDocument();
  });

  it('marca el negativo con data-estado y el menos antes del peso', () => {
    render(<Monto valor="-1500.5" />);
    const monto = screen.getByText('−$1,500.50');
    expect(monto).toHaveAttribute('data-estado', 'negativo');
  });

  it('un valor que redondea a cero no es negativo', () => {
    render(<Monto valor="-0.001" />);
    const monto = screen.getByText('$0.00');
    expect(monto).toHaveAttribute('data-estado', 'normal');
  });

  it('moneda={false} omite el peso', () => {
    render(<Monto valor="1234.5" moneda={false} />);
    expect(screen.getByText('1,234.50')).toBeInTheDocument();
  });

  it.each([
    ['cadena inválida', 'abc'],
    ['vacío', ''],
    ['exponente', '1e3'],
    ['hexadecimal', '0x1F'],
    ['null', null],
    ['undefined', undefined],
  ])('muestra el marcador de no disponible para %s', (_caso, valor) => {
    const { container } = render(<Monto valor={valor} />);
    const monto = container.firstElementChild;
    expect(monto).toHaveAttribute('data-estado', 'invalido');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Monto no disponible')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0\.00|NaN/);
  });

  it('oculta el guion a lectores de pantalla y deja el texto alternativo', () => {
    render(<Monto valor={null} />);
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Monto no disponible')).not.toHaveAttribute(
      'aria-hidden',
    );
  });
});
