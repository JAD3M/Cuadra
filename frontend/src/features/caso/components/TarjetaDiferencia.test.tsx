import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaDiferencia } from './TarjetaDiferencia';

function dibujar(diferenciaMonto: string | null, toleranciaMonto = '0.5000') {
  return render(
    <TarjetaDiferencia
      diferenciaMonto={diferenciaMonto}
      toleranciaMonto={toleranciaMonto}
    />,
  );
}

const NOTA = 'Dentro de la tolerancia de la empresa';

describe('TarjetaDiferencia', () => {
  it('muestra el título y la diferencia con signo', () => {
    dibujar('-0.3000');
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
    expect(screen.getByText('−$0.30')).toBeInTheDocument();
  });

  it('nunca muestra un cero negativo', () => {
    const { container } = dibujar('-0.0000');
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/[-−]\$0\.00/);
  });

  it('resalta por comparación decimal: cero no, cualquier otra sí', () => {
    const { container, unmount } = dibujar('0.0000');
    expect(container.querySelector('[data-clase="cero"]')).not.toBeNull();
    unmount();
    const otra = dibujar('40.0000');
    expect(
      otra.container.querySelector('[data-clase="distinta"]'),
    ).not.toBeNull();
  });

  it('una diferencia menor a un centavo muestra $0.00 y texto oculto', () => {
    const { container } = dibujar('0.0040');
    const cifra = container.querySelector('[data-clase="subcentavo"]');
    expect(cifra).not.toBeNull();
    expect(cifra?.textContent).toContain('$0.00');
    expect(screen.getByText('menor a un centavo')).toHaveClass('solo-lectores');
  });

  it('la nota de tolerancia aparece dentro y no fuera', () => {
    const dentro = dibujar('-0.3000');
    expect(screen.getByText(NOTA)).toBeInTheDocument();
    dentro.unmount();
    dibujar('40.0000');
    expect(screen.queryByText(NOTA)).toBeNull();
  });

  it('en el límite 0.5000 / 0.5000 hay nota y con 0.5001 no', () => {
    const limite = dibujar('0.5000', '0.5000');
    expect(screen.getByText(NOTA)).toBeInTheDocument();
    limite.unmount();
    dibujar('0.5001', '0.5000');
    expect(screen.queryByText(NOTA)).toBeNull();
  });

  it('muestra la escala con la tolerancia formateada', () => {
    dibujar('0.4000');
    expect(screen.getByText(/^tolerancia/).textContent).toContain('$0.50');
  });

  it('el ancho de la barra es el porcentaje entero de la tolerancia', () => {
    dibujar('0.4000');
    expect(screen.getByTestId('barra-tolerancia')).toHaveStyle({
      width: '80%',
    });
  });

  it('la barra no pasa de 100% y sin diferencia queda en 0%', () => {
    const grande = dibujar('40.0000');
    expect(screen.getByTestId('barra-tolerancia')).toHaveStyle({
      width: '100%',
    });
    grande.unmount();
    dibujar(null);
    expect(screen.getByTestId('barra-tolerancia')).toHaveStyle({ width: '0%' });
  });

  it('sin diferencia no hay nota de tolerancia', () => {
    dibujar(null);
    expect(screen.queryByText(NOTA)).toBeNull();
  });
});
