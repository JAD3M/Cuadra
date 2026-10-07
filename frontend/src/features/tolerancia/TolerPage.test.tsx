import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '@/shared/sesion';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { TolerPage } from './TolerPage';

describe('TolerPage: el contenedor se reinicia con la época (ADR-4, TOL-9.5)', () => {
  it('un borrador escrito en una época no sobrevive al cambio de época', async () => {
    let estado: SessionState = sesionConEpoca(1);
    const { rerender } = render(<TolerPage />, {
      wrapper: envoltura(clienteDePruebas(), () => estado),
    });
    const campo = async () =>
      screen.findByRole('textbox', {
        name: 'Nuevo valor (0 a 100, hasta 4 decimales)',
      });
    const u = userEvent.setup();
    await u.clear(await campo());
    await u.type(await campo(), '9.9');
    expect(await campo()).toHaveValue('9.9');

    estado = sesionConEpoca(2);
    rerender(<TolerPage />);
    // Control positivo: la época nueva volvió a leer el valor y pintó el campo.
    await screen.findByText('$0.50');
    expect(await campo()).toHaveValue('0.50');
  });
});
