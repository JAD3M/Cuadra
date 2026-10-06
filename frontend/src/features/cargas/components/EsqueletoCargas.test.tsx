import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EsqueletoCargas } from './EsqueletoCargas';

describe('EsqueletoCargas', () => {
  it('está ocupado y anuncia «Cargando cargas» (CRG-1.1)', () => {
    render(<EsqueletoCargas />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Cargando cargas');
  });

  it('pinta cinco barras decorativas y ninguna acción', () => {
    const { container } = render(<EsqueletoCargas />);
    const barras = container.querySelectorAll('[aria-hidden="true"]');
    expect(barras).toHaveLength(5);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
