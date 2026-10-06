import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AlertaAccion, type AlertaAccionProps } from './AlertaAccion';

function dibujar(props: AlertaAccionProps) {
  return render(
    <MemoryRouter>
      <AlertaAccion {...props} />
    </MemoryRouter>,
  );
}

describe('AlertaAccion', () => {
  it('segregación (D-08): copy aprobado, sin el código interno', () => {
    dibujar({ tipo: 'segregacion' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No puedes confirmar este caso.');
    expect(alerta).toHaveTextContent(
      'Quien subió el CFDI o el estado de cuenta no puede confirmarlo. Pide a otra persona de la empresa que lo revise.',
    );
    expect(alerta.textContent).not.toMatch(/acceso_denegado/i);
  });

  it('sin permiso (rechazar o sin D-08): copy genérico', () => {
    dibujar({ tipo: 'sin_permiso' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).not.toHaveTextContent('No puedes confirmar este caso.');
  });

  it('conflicto (409): copy y «Recargar caso» que recarga solo al hacer clic', async () => {
    const onRecargar = vi.fn();
    dibujar({ tipo: 'conflicto', onRecargar });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Este caso ya cambió.');
    expect(alerta).toHaveTextContent(
      'Otra persona lo resolvió o la propuesta ya no está vigente. Recarga para ver su estado actual.',
    );
    expect(onRecargar).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Recargar caso' }),
    );
    expect(onRecargar).toHaveBeenCalledTimes(1);
  });

  it('no encontrado (404): copy de no encontrado con el enlace a la bandeja', () => {
    dibujar({ tipo: 'no_encontrado' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No encontramos este caso.',
    );
    expect(
      screen.getByRole('link', { name: 'Volver a la bandeja' }),
    ).toHaveAttribute('href', '/bandeja');
  });

  it('conexión: mensaje de conectividad sin botones (los controles se reactivan)', () => {
    dibujar({ tipo: 'conexion' });
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('contrato: «No pudimos mostrar este caso.»', () => {
    dibujar({ tipo: 'contrato' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos mostrar este caso.',
    );
  });

  it('genérico: reutiliza el mensaje de conectividad aprobado', () => {
    dibujar({ tipo: 'generico' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('entrega la referencia para mover el foco a la alerta', () => {
    const ref = createRef<HTMLDivElement>();
    dibujar({ tipo: 'segregacion', ref });
    expect(ref.current).toBe(screen.getByRole('alert'));
  });
});
