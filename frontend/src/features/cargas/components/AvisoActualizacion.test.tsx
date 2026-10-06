import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvisoActualizacion } from './AvisoActualizacion';

describe('AvisoActualizacion', () => {
  it('mientras actualiza: solo la leyenda, sin botón (G13, K5)', () => {
    render(<AvisoActualizacion estado="actualizando" variante="cabecera" />);
    expect(
      screen.getByText('Se actualiza sola mientras procesa'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
    expect(screen.queryByText('La lista dejó de actualizarse.')).toBeNull();
  });

  it.each(['cabecera', 'tarjeta'] as const)(
    'detenida (%s): el aviso y el botón Actualizar, que avisa una vez (11.4)',
    async (variante) => {
      const alActualizar = vi.fn();
      render(
        <AvisoActualizacion
          estado="detenida"
          variante={variante}
          onActualizar={alActualizar}
        />,
      );
      expect(
        screen.getByText('La lista dejó de actualizarse.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Se actualiza sola mientras procesa'),
      ).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
      expect(alActualizar).toHaveBeenCalledTimes(1);
    },
  );

  it('no abre una región viva propia: la leyenda del mockup es texto (la región de la tarjeta ya anuncia)', () => {
    render(<AvisoActualizacion estado="detenida" variante="tarjeta" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
