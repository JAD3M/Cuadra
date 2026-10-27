import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBitacora, VacioBitacora } from './EstadosBitacora';

describe('VacioBitacora', () => {
  it('sin filtros explica qué aparecerá y no ofrece restablecer', () => {
    render(<VacioBitacora conFiltros={false} onRestablecer={vi.fn()} />);
    expect(
      screen.getByText('Aún no hay eventos en la bitácora.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aquí aparecerá cada confirmación, rechazo, cambio de tolerancia, invitación, cambio de rol y acceso denegado de la empresa.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con filtros ofrece restablecerlos', async () => {
    const onRestablecer = vi.fn();
    render(<VacioBitacora conFiltros onRestablecer={onRestablecer} />);
    expect(
      screen.getByText('No hay eventos con estos filtros.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Prueba con otra entidad, acción, usuario o rango de fechas.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Restablecer filtros' }),
    );
    expect(onRestablecer).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorBitacora', () => {
  it('conexión: título, detalle y Reintentar', async () => {
    const onReintentar = vi.fn();
    render(<ErrorBitacora clase="conexion" onReintentar={onReintentar} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin permiso: título y detalle, sin Reintentar', () => {
    render(<ErrorBitacora clase="sin_permiso" onReintentar={vi.fn()} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('otro: solo el título y Reintentar', () => {
    render(<ErrorBitacora clase="otro" onReintentar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^No se pudo completar la solicitud\.Reintentar$/,
    );
  });
});
