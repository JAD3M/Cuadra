import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstadoCargaCaso } from './EstadoCargaCaso';

describe('EstadoCargaCaso', () => {
  it('es una región ocupada con el texto accesible «Cargando caso»', () => {
    render(<EstadoCargaCaso />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Cargando caso');
  });

  it('no ofrece ninguna acción mientras carga', () => {
    render(<EstadoCargaCaso />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
