import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoVarias } from './AvisoVarias';

describe('AvisoVarias', () => {
  it.each([2, 3, 12])(
    'con %i propuestas muestra el aviso con la cantidad real',
    (n) => {
      render(<AvisoVarias cantidad={n} />);
      expect(
        screen.getByText(
          `Este movimiento tiene ${n} propuestas. Al confirmar una, las demás se rechazan.`,
        ),
      ).toBeInTheDocument();
    },
  );

  it('con una propuesta o ninguna no aparece', () => {
    const { container, rerender } = render(<AvisoVarias cantidad={1} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AvisoVarias cantidad={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('se anuncia de forma cortés (role status)', () => {
    render(<AvisoVarias cantidad={3} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
