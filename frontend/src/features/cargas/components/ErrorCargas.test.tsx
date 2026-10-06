import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorCargas } from './ErrorCargas';

describe('ErrorCargas', () => {
  it('fallo: copy de conectividad y «Reintentar» que reintenta (CRG-1.3)', async () => {
    const onReintentar = vi.fn();
    render(<ErrorCargas tipo="fallo" onReintentar={onReintentar} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin_permiso: copy de permiso y sin «Reintentar»', () => {
    render(<ErrorCargas tipo="sin_permiso" onReintentar={vi.fn()} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('fallo sin función de reintento no inventa el botón', () => {
    render(<ErrorCargas tipo="fallo" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
