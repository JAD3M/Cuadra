import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegionResultado } from './RegionResultado';

describe('RegionResultado', () => {
  it('es una región de estado educada, enfocable solo por código', () => {
    render(<RegionResultado subiendo={false} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('tabindex', '-1');
    // `role=status` ya es `aria-live=polite`; nunca assertive.
    expect(region).not.toHaveAttribute('aria-live', 'assertive');
  });

  it('está montada y vacía hasta que hay algo que decir', () => {
    render(<RegionResultado subiendo={false} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('subiendo: anuncia «Subiendo tus archivos»', () => {
    render(<RegionResultado subiendo />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Subiendo tus archivos',
    );
  });

  it('la misma región se llena después sin desmontarse', () => {
    const { rerender } = render(<RegionResultado subiendo={false} />);
    const antes = screen.getByRole('status');
    rerender(
      <RegionResultado subiendo={false}>
        <p>Resultado</p>
      </RegionResultado>,
    );
    expect(screen.getByRole('status')).toBe(antes);
    expect(antes).toHaveTextContent('Resultado');
  });

  it('recibe el foco por su ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<RegionResultado subiendo={false} regionRef={ref} />);
    ref.current?.focus();
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('no trae un control para descartar el resultado (M13)', () => {
    render(
      <RegionResultado subiendo={false}>
        <p>Resultado</p>
      </RegionResultado>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
