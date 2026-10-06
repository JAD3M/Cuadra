import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AlertaSubida } from './AlertaSubida';

describe('AlertaSubida', () => {
  it('rechazo: el título fijo y el motivo del servidor como texto plano (10.1)', () => {
    render(
      <AlertaSubida
        fallo={{
          clase: 'rechazo',
          detalle:
            'El encabezado del CSV no coincide con el perfil banco-norte.',
        }}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo procesar la carga.');
    expect(alerta).toHaveTextContent(
      'El encabezado del CSV no coincide con el perfil banco-norte.',
    );
  });

  it('rechazo sin motivo: solo el título, sin línea de detalle vacía (10.1)', () => {
    render(<AlertaSubida fallo={{ clase: 'rechazo', detalle: null }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(/^No se pudo procesar la carga\.$/);
  });

  it('un motivo con marcado se queda como texto y no crea elementos (10.2)', () => {
    const { container } = render(
      <AlertaSubida
        fallo={{ clase: 'rechazo', detalle: '<script>x</script><b>y</b>' }}
      />,
    );
    expect(screen.getByText('<script>x</script><b>y</b>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('demasiado grande: título y detalle del mockup (10.3)', () => {
    render(<AlertaSubida fallo={{ clase: 'demasiado_grande' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Los archivos pesan demasiado.');
    expect(alerta).toHaveTextContent(
      'Divide la carga en partes más pequeñas e inténtalo de nuevo.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sin permiso: el texto de la bandeja y nada del servidor (10.4)', () => {
    render(<AlertaSubida fallo={{ clase: 'sin_permiso' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(alerta).not.toHaveTextContent('acceso_denegado');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('conexión: el texto de conectividad y Reintentar, que avisa una vez (10.5, mockup error_subida)', async () => {
    const alReintentar = vi.fn();
    render(
      <AlertaSubida
        fallo={{ clase: 'conexion' }}
        onReintentar={alReintentar}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });

  it('conexión sin acción de reintento: no ofrece el botón', () => {
    render(<AlertaSubida fallo={{ clase: 'conexion' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('error inesperado: título y detalle del mockup v25, sin Reintentar', () => {
    render(<AlertaSubida fallo={{ clase: 'otro' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).toHaveTextContent(
      'Tus archivos siguen seleccionados. Inténtalo de nuevo en unos minutos.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('solo la conexión ofrece Reintentar aunque se pase la acción', () => {
    for (const fallo of [
      { clase: 'rechazo', detalle: null },
      { clase: 'demasiado_grande' },
      { clase: 'sin_permiso' },
      { clase: 'otro' },
    ] as const) {
      const { unmount } = render(
        <AlertaSubida fallo={fallo} onReintentar={() => undefined} />,
      );
      expect(screen.queryByRole('button')).toBeNull();
      unmount();
    }
  });

  it('la alerta se puede enfocar desde código con su ref, sin entrar al orden de tabulación', () => {
    const ref = createRef<HTMLDivElement>();
    render(<AlertaSubida ref={ref} fallo={{ clase: 'sin_permiso' }} />);
    expect(ref.current).toBe(screen.getByRole('alert'));
    expect(ref.current).toHaveAttribute('tabindex', '-1');
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });
});
