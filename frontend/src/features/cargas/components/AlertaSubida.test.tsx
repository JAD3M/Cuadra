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

  it('pdf_sin_texto: título y detalle fijos del mockup', () => {
    render(<AlertaSubida fallo={{ clase: 'pdf_sin_texto' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo leer el PDF');
    expect(alerta).toHaveTextContent(
      'El PDF no tiene texto seleccionable (parece una imagen escaneada). Descarga el PDF desde el portal del banco.',
    );
  });

  it('pdf_ilegible: título y detalle fijos del mockup', () => {
    render(<AlertaSubida fallo={{ clase: 'pdf_ilegible' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo leer el PDF');
    expect(alerta).toHaveTextContent(
      'No reconocimos el formato del estado de cuenta BBVA.',
    );
  });
});

describe('AlertaSubida: rechazos del PDF (historia 3.3)', () => {
  const LINEAS = [
    { linea: 18, texto: '07/SEP PAGO SERVICIO NO RECONOCIDO 1,25' },
    { linea: 31, texto: '12/SEP CARGO ILEGIBLE' },
  ];

  it('saldos que no cuadran: título, mensaje, montos tal como llegaron y líneas', () => {
    render(
      <AlertaSubida
        fallo={{
          clase: 'pdf_saldos_no_cuadran',
          mensaje: 'Los saldos no cuadran (texto del servidor).',
          saldoFinal: '11250.50',
          saldoEsperado: '11500.50',
          diferencia: '-250.00',
          lineas: LINEAS,
        }}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(
      'Archivo rechazado: los saldos no cuadran',
    );
    expect(alerta).toHaveTextContent(
      'Los saldos no cuadran (texto del servidor).',
    );
    expect(screen.getByText('Saldo final del PDF')).toBeInTheDocument();
    expect(screen.getByText('11,250.50')).toBeInTheDocument();
    expect(
      screen.getByText('Saldo esperado con los movimientos'),
    ).toBeInTheDocument();
    expect(screen.getByText('11,500.50')).toBeInTheDocument();
    expect(screen.getByText('Diferencia')).toBeInTheDocument();
    expect(screen.getByText('−250.00')).toBeInTheDocument();
    expect(screen.getByText('Líneas que no se pudieron leer')).toBeVisible();
    expect(
      screen.getByText('Línea 18 · 07/SEP PAGO SERVICIO NO RECONOCIDO 1,25'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Línea 31 · 12/SEP CARGO ILEGIBLE'),
    ).toBeInTheDocument();
  });

  it('saldos que no cuadran sin saldo final del servidor: no se inventa esa fila', () => {
    render(
      <AlertaSubida
        fallo={{
          clase: 'pdf_saldos_no_cuadran',
          mensaje: null,
          saldoEsperado: '11500.50',
          diferencia: '-250.00',
          lineas: [],
        }}
      />,
    );
    expect(screen.queryByText('Saldo final del PDF')).toBeNull();
    expect(screen.getByText('11,500.50')).toBeInTheDocument();
    expect(screen.queryByText('Líneas que no se pudieron leer')).toBeNull();
  });

  it('hay líneas sin leer: título, mensaje y líneas', () => {
    render(
      <AlertaSubida
        fallo={{
          clase: 'pdf_lineas_no_leidas',
          mensaje: 'No pudimos leer algunas líneas.',
          lineas: [LINEAS[0]!],
        }}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Archivo rechazado: hay líneas sin leer');
    expect(alerta).toHaveTextContent('No pudimos leer algunas líneas.');
    expect(
      screen.getByText('Línea 18 · 07/SEP PAGO SERVICIO NO RECONOCIDO 1,25'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Saldo esperado con los movimientos')).toBeNull();
  });

  it('sin movimientos: título y mensaje, sin lista de líneas', () => {
    render(
      <AlertaSubida
        fallo={{
          clase: 'pdf_sin_movimientos',
          mensaje: 'No pudimos leer ningún movimiento.',
        }}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Archivo rechazado: sin movimientos');
    expect(alerta).toHaveTextContent('No pudimos leer ningún movimiento.');
    expect(screen.queryByText('Líneas que no se pudieron leer')).toBeNull();
  });

  it('el texto de una línea queda como texto plano', () => {
    const { container } = render(
      <AlertaSubida
        fallo={{
          clase: 'pdf_lineas_no_leidas',
          mensaje: null,
          lineas: [{ linea: 1, texto: '<b>x</b>' }],
        }}
      />,
    );
    expect(container.querySelector('b')).toBeNull();
  });
});
