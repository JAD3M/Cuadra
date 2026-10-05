import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsigniaIa } from './InsigniaIa';

describe('InsigniaIa', () => {
  it('muestra "✦ IA" para una sugerencia de IA', () => {
    const { container } = render(<InsigniaIa simulada={false} />);
    expect(container).toHaveTextContent(/^✦IA$/);
    expect(screen.getByText('IA')).toBeInTheDocument();
  });

  it('muestra "✦ IA · simulada" para la del proveedor simulado', () => {
    const { container } = render(<InsigniaIa simulada />);
    expect(container).toHaveTextContent(/^✦IA · simulada$/);
    expect(screen.getByText('IA · simulada')).toBeInTheDocument();
  });

  it('el glifo es decorativo y el texto lleva el significado', () => {
    render(<InsigniaIa simulada />);
    const glifo = screen.getByText('✦');
    expect(glifo).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('IA · simulada')).not.toHaveAttribute(
      'aria-hidden',
    );
  });
});
