import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ESTADOS_CARGA, type EstadoCarga } from '@/shared/dominio';
import { BarraAvance } from './BarraAvance';

describe('BarraAvance', () => {
  it('pendiente: pista vacía, imagen con nombre «Avance: Pendiente»', () => {
    render(<BarraAvance estado="pendiente" />);
    const barra = screen.getByRole('img', { name: 'Avance: Pendiente' });
    expect(barra).toHaveAttribute('data-avance', 'vacia');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('procesando: progressbar indeterminada, sin aria-valuenow', () => {
    render(<BarraAvance estado="procesando" />);
    const barra = screen.getByRole('progressbar', {
      name: 'Avance: Procesando',
    });
    expect(barra).toHaveAttribute('data-avance', 'indeterminada');
    expect(barra).not.toHaveAttribute('aria-valuenow');
    expect(barra).not.toHaveAttribute('aria-valuetext');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it.each<[EstadoCarga, string, string]>([
    ['procesada', 'Avance: Procesada', 'verde'],
    ['con_errores', 'Avance: Con errores', 'naranja'],
    ['fallida', 'Avance: Fallida', 'roja'],
  ])('%s: relleno completo como imagen «%s»', (estado, nombre, avance) => {
    render(<BarraAvance estado={estado} />);
    const barra = screen.getByRole('img', { name: nombre });
    expect(barra).toHaveAttribute('data-avance', avance);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('nunca muestra un porcentaje ni un número, en ningún estado', () => {
    for (const estado of ESTADOS_CARGA) {
      const { container, unmount } = render(<BarraAvance estado={estado} />);
      expect(container.textContent).not.toMatch(/%|\d/);
      for (const atributo of [
        'aria-valuenow',
        'aria-valuemax',
        'aria-valuemin',
      ]) {
        expect(container.querySelector(`[${atributo}]`)).toBeNull();
      }
      expect(container.innerHTML).not.toContain('%');
      unmount();
    }
  });

  it('un procesando con la mitad de los registros sigue indeterminado (3.3)', () => {
    // La barra solo recibe el estado: los contadores no pueden moverla.
    render(<BarraAvance estado="procesando" />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow',
    );
  });
});
