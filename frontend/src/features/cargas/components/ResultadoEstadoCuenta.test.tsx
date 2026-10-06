import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoEstadoCuenta } from './ResultadoEstadoCuenta';

const FILAS = [
  { fila: 4, motivo: 'Monto inválido' },
  { fila: 17, motivo: 'Fecha vacía' },
];

describe('ResultadoEstadoCuenta', () => {
  it('el resumen: registros cargados y con error, cada cifra sin partirse', () => {
    render(<ResultadoEstadoCuenta registros={98} conError={2} filas={FILAS} />);
    const resumen = screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent === '98 registros cargados, 2 con error.',
    );
    for (const cifra of [
      within(resumen).getByText('98'),
      within(resumen).getByText('2'),
    ]) {
      expect(cifra.className).toMatch(/cifra/);
    }
  });

  it('una línea por fila rechazada: «Fila {n}: {motivo}»', () => {
    render(<ResultadoEstadoCuenta registros={98} conError={2} filas={FILAS} />);
    const items = within(
      screen.getByRole('region', { name: 'Filas con error' }),
    ).getAllByRole('listitem');
    expect(items.map((i) => i.textContent?.replace('✕', ''))).toEqual([
      'Fila 4: Monto inválido',
      'Fila 17: Fecha vacía',
    ]);
  });

  it('las filas buenas no se listan: sin errores no hay lista', () => {
    render(<ResultadoEstadoCuenta registros={210} conError={0} filas={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText('210')).toBeInTheDocument();
  });

  it('el motivo es texto plano (8.7)', () => {
    const { container } = render(
      <ResultadoEstadoCuenta
        registros={1}
        conError={1}
        filas={[{ fila: 2, motivo: '<img src=x onerror=alert(1)>' }]}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('Fila 2: <img src=x onerror=alert(1)>');
  });

  it('la región se desplaza con el teclado y no se anuncia entera', () => {
    render(<ResultadoEstadoCuenta registros={98} conError={2} filas={FILAS} />);
    const region = screen.getByRole('region', { name: 'Filas con error' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('aria-live', 'off');
  });

  it('no muestra la cuenta ni controles para cerrar (6.4, M13)', () => {
    render(<ResultadoEstadoCuenta registros={98} conError={2} filas={FILAS} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
