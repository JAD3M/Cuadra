import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BannerResolucion,
  type BannerResolucionProps,
} from './BannerResolucion';

function dibujar(props: Partial<BannerResolucionProps> = {}) {
  return render(
    <BannerResolucion
      accion="confirmar"
      detalle={null}
      nota={null}
      {...props}
    />,
  );
}

describe('BannerResolucion', () => {
  it('es una región de estado cortés que se puede enfocar desde código', () => {
    dibujar();
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('tabindex', '-1');
    expect(banner).not.toHaveAttribute('aria-live', 'assertive');
  });

  it('confirmar: el título aprobado y el detalle «usuario · fecha» recibido', () => {
    dibujar({ detalle: 'Ana · 2026-10-05' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Conciliación confirmada. El movimiento y el CFDI quedan cerrados.',
    );
    expect(screen.getByText('Ana · 2026-10-05')).toBeInTheDocument();
  });

  it('sin detalle no pinta la línea del detalle', () => {
    dibujar({ detalle: null });
    expect(screen.getByRole('status').querySelectorAll('span')).toHaveLength(0);
  });

  it('muestra la nota que recibe y ninguna si no hay', () => {
    const { rerender } = dibujar({
      nota: 'Las demás propuestas de este movimiento se rechazaron.',
    });
    expect(
      screen.getByText(
        'Las demás propuestas de este movimiento se rechazaron.',
      ),
    ).toBeInTheDocument();
    rerender(
      <BannerResolucion accion="confirmar" detalle={null} nota={null} />,
    );
    expect(screen.queryByText(/propuestas de este movimiento/)).toBeNull();
  });

  it('rechazar: «Propuesta rechazada.» con su nota', () => {
    dibujar({
      accion: 'rechazar',
      nota: 'El movimiento vuelve a sin match.',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Propuesta rechazada.',
    );
    expect(
      screen.getByText('El movimiento vuelve a sin match.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Conciliación confirmada/)).toBeNull();
  });

  it('es el mismo elemento que la referencia, para mover el foco', () => {
    const ref = createRef<HTMLDivElement>();
    dibujar({ ref });
    expect(ref.current).toBe(screen.getByRole('status'));
  });

  it('no navega ni ofrece acciones', () => {
    dibujar();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
