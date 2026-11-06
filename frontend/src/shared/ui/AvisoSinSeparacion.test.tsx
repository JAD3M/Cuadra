import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoSinSeparacion } from './AvisoSinSeparacion';

describe('AvisoSinSeparacion', () => {
  it('es un aviso de estado con el título y el detalle de la maqueta', () => {
    render(<AvisoSinSeparacion />);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent(
      'Esta empresa opera sin separación de funciones.',
    );
    expect(aviso).toHaveTextContent(
      'Quien sube una carga también puede confirmar sus conciliaciones. Lo desactivó el dueño de la plataforma.',
    );
    expect(aviso.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
