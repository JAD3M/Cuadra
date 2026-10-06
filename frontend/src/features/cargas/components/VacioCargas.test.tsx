import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VacioCargas } from './VacioCargas';

describe('VacioCargas', () => {
  it('muestra el texto del estado vacío (CRG-1.2)', () => {
    render(<VacioCargas />);
    expect(screen.getByText('Aún no hay cargas.')).toBeInTheDocument();
    expect(
      screen.getByText('Sube un CFDI o un estado de cuenta para empezar.'),
    ).toBeInTheDocument();
  });

  it('no ofrece ninguna acción', () => {
    render(<VacioCargas />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
