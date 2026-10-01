import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EstadoChip,
  TONOS_ESTADO_CHIP,
  type TonoEstadoChip,
} from './EstadoChip';

describe('EstadoChip', () => {
  it.each(TONOS_ESTADO_CHIP)(
    'muestra la etiqueta de texto del tono %s',
    (tono) => {
      render(<EstadoChip tono={tono}>Etiqueta {tono}</EstadoChip>);
      const chip = screen.getByText(`Etiqueta ${tono}`);
      expect(chip).toHaveAttribute('data-tono', tono);
    },
  );

  it('un tono desconocido en ejecución se pinta como neutral', () => {
    const tonoInvalido = 'inventado' as unknown as TonoEstadoChip;
    render(<EstadoChip tono={tonoInvalido}>Algo raro</EstadoChip>);
    const chip = screen.getByText('Algo raro');
    expect(chip).toHaveAttribute('data-tono', 'neutral');
  });

  it.each(['', 'SUGERENCIA', 'desconocido'])(
    'un tono inválido (%j) nunca se hace pasar por un estado válido',
    (valor) => {
      render(
        <EstadoChip tono={valor as unknown as TonoEstadoChip}>
          Texto
        </EstadoChip>,
      );
      expect(screen.getByText('Texto')).toHaveAttribute('data-tono', 'neutral');
    },
  );

  it('rechaza tonos desconocidos en tiempo de compilación', () => {
    // @ts-expect-error el tono no existe
    render(<EstadoChip tono="otro">Texto</EstadoChip>);
    expect(screen.getByText('Texto')).toBeInTheDocument();
  });
});
