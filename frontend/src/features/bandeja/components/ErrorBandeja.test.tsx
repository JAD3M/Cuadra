import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBandeja } from './ErrorBandeja';

describe('ErrorBandeja', () => {
  it('es una alerta con título, detalle y un Reintentar que lo pide', async () => {
    const onReintentar = vi.fn();
    render(
      <ErrorBandeja
        titulo="No se pudo conectar con el servidor."
        detalle="Revisa tu conexión e inténtalo de nuevo."
        onReintentar={onReintentar}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledOnce();
  });

  it('sin onReintentar no ofrece reintento', () => {
    render(<ErrorBandeja titulo="No tienes permiso para esta acción." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
