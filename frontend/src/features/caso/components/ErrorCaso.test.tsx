import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ErrorCaso, type ErrorCasoProps } from './ErrorCaso';

function dibujar(props: ErrorCasoProps) {
  return render(
    <MemoryRouter>
      <ErrorCaso {...props} />
    </MemoryRouter>,
  );
}

describe('ErrorCaso', () => {
  it('conexión: copy de conectividad y «Reintentar» que reintenta', async () => {
    const onReintentar = vi.fn();
    dibujar({ tipo: 'conexion', onReintentar });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('contrato: copy de datos inesperados y «Reintentar»', async () => {
    const onReintentar = vi.fn();
    dibujar({ tipo: 'contrato', onReintentar });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos mostrar este caso.');
    expect(alerta).toHaveTextContent(
      'El servidor respondió con datos inesperados. Inténtalo de nuevo más tarde.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('no encontrado: copy y enlace «Volver a la bandeja» a /bandeja', () => {
    dibujar({ tipo: 'no_encontrado' });
    expect(screen.getByText('No encontramos este caso.')).toBeInTheDocument();
    expect(
      screen.getByText('Puede que no exista o que pertenezca a otra empresa.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Volver a la bandeja' }),
    ).toHaveAttribute('href', '/bandeja');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('sin permiso: copy genérico de permiso y nada que reintentar', () => {
    dibujar({ tipo: 'sin_permiso' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no muestra «Reintentar» si no hay quién lo atienda', () => {
    dibujar({ tipo: 'conexion' });
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
