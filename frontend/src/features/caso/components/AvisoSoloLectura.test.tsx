import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoSoloLectura } from './AvisoSoloLectura';

describe('AvisoSoloLectura', () => {
  it('explica que el rol no confirma ni rechaza y se anuncia con role status', () => {
    render(<AvisoSoloLectura />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Solo lectura: tu rol no puede confirmar ni rechazar.',
    );
  });
});
