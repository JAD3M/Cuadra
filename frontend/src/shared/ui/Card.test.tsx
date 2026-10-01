import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renderiza un div con su contenido por omisión', () => {
    render(<Card>Contenido</Card>);
    const tarjeta = screen.getByText('Contenido');
    expect(tarjeta.tagName).toBe('DIV');
    expect(tarjeta).toHaveAttribute('data-elevada', 'false');
  });

  it.each(['section', 'article'] as const)(
    'permite renderizar como %s',
    (as) => {
      render(<Card as={as}>Contenido</Card>);
      expect(screen.getByText('Contenido').tagName).toBe(as.toUpperCase());
    },
  );

  it('marca la superficie elevada', () => {
    render(<Card elevada>Contenido</Card>);
    expect(screen.getByText('Contenido')).toHaveAttribute(
      'data-elevada',
      'true',
    );
  });

  it('rechaza elementos no permitidos en tiempo de compilación', () => {
    // @ts-expect-error solo div, section y article
    render(<Card as="button">Contenido</Card>);
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});
