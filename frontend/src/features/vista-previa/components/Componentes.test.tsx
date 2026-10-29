import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { vistaPrevia } from '@/features/vista-previa/pruebas';
import { AccionesVistaPrevia } from './AccionesVistaPrevia';
import { BannerDecision } from './BannerDecision';
import { ConfirmarRechazo } from './ConfirmarRechazo';
import { EstadoVistaPrevia } from './EstadoVistaPrevia';
import { ResumenLectura } from './ResumenLectura';
import { TablaMovimientos } from './TablaMovimientos';

const enRuta = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ResumenLectura', () => {
  it('archivo, banco, total y saldos con miles y dos decimales', () => {
    render(
      <ResumenLectura
        archivo="estado-sep-2026.pdf"
        banco="bbva"
        total={14}
        saldoInicial="10000.0000"
        saldoFinal="11250.5000"
      />,
    );
    const resumen = screen.getByRole('region', {
      name: 'Resumen de la lectura',
    });
    expect(resumen).toHaveTextContent('estado-sep-2026.pdf · BBVA');
    expect(within(resumen).getByText('Movimientos leídos')).toBeVisible();
    expect(within(resumen).getByText('14')).toBeVisible();
    expect(within(resumen).getByText('10,000.00')).toBeVisible();
    expect(within(resumen).getByText('11,250.50')).toBeVisible();
    expect(
      within(resumen).getByText('Los saldos cuadran con los movimientos.'),
    ).toBeVisible();
    expect(within(resumen).queryByRole('status')).not.toBeInTheDocument();
  });

  it('sin saldos: «—» y la caja informativa, sin afirmar que cuadran', () => {
    render(
      <ResumenLectura
        archivo="a.pdf"
        banco={null}
        total={3}
        saldoInicial={null}
        saldoFinal={null}
      />,
    );
    const resumen = screen.getByRole('region', {
      name: 'Resumen de la lectura',
    });
    expect(within(resumen).getAllByText('—')).toHaveLength(2);
    expect(within(resumen).getByRole('status')).toHaveTextContent(
      'Esta carga se leyó antes de que Cuadra guardara los saldos del PDF, así que no se pueden mostrar.',
    );
    expect(
      within(resumen).queryByText('Los saldos cuadran con los movimientos.'),
    ).not.toBeInTheDocument();
    expect(resumen).toHaveTextContent('a.pdf');
    expect(resumen).not.toHaveTextContent('·');
  });
});

describe('TablaMovimientos', () => {
  it('fecha, referencia y monto con signo; la referencia nula va «—»', () => {
    render(<TablaMovimientos movimientos={vistaPrevia().movimientos} />);
    expect(screen.getByText('Montos en pesos mexicanos (MXN)')).toBeVisible();
    const filas = screen.getAllByRole('row');
    expect(filas).toHaveLength(4);
    const [fecha, referencia, monto] = within(filas[1]!).getAllByRole('cell');
    expect(fecha).toHaveTextContent('2026-09-01');
    expect(referencia).toHaveTextContent(
      'SPEI RECIBIDO 4471 ABARROTES DEL NORTE',
    );
    expect(monto).toHaveTextContent('+1,500.00');
    expect(within(filas[2]!).getAllByRole('cell')[2]).toHaveTextContent(
      '-250.00',
    );
    expect(within(filas[3]!).getAllByRole('cell')[1]).toHaveTextContent('—');
    expect(within(filas[3]!).getAllByRole('cell')[2]).toHaveTextContent(
      '-3,820.40',
    );
  });

  it('abonos y cargos se distinguen por tono además del signo', () => {
    render(<TablaMovimientos movimientos={vistaPrevia().movimientos} />);
    const filas = screen.getAllByRole('row');
    expect(
      within(filas[1]!).getByText('+1,500.00').closest('[data-tipo]'),
    ).toHaveAttribute('data-tipo', 'abono');
    expect(
      within(filas[2]!).getByText('-250.00').closest('[data-tipo]'),
    ).toHaveAttribute('data-tipo', 'cargo');
  });
});

describe('AccionesVistaPrevia', () => {
  it('dos botones reales y la pista; sin barra de progreso', async () => {
    const alAceptar = vi.fn();
    const alRechazar = vi.fn();
    render(
      <AccionesVistaPrevia
        ocupado={null}
        onAceptar={alAceptar}
        onRechazar={alRechazar}
      />,
    );
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Aceptar e importar' }));
    await u.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(alAceptar).toHaveBeenCalledTimes(1);
    expect(alRechazar).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        'Al aceptar, los movimientos pasan a conciliación y el motor corre al terminar.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it.each([
    ['aceptar', 'Importando…', 'Rechazar'],
    ['rechazar', 'Aceptar e importar', 'Rechazando…'],
  ] as const)('ocupado %s: ambos botones apagados y barra', (ocupado, a, r) => {
    render(
      <AccionesVistaPrevia
        ocupado={ocupado}
        onAceptar={() => undefined}
        onRechazar={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: a })).toBeDisabled();
    expect(screen.getByRole('button', { name: r })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('ConfirmarRechazo', () => {
  it('es un alertdialog nombrado, con la cuenta de movimientos', async () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();
    render(
      <ConfirmarRechazo
        total={14}
        onConfirmar={alConfirmar}
        onCancelar={alCancelar}
      />,
    );
    const dialogo = screen.getByRole('alertdialog', {
      name: '¿Rechazar esta vista previa?',
    });
    expect(dialogo).toHaveTextContent(
      'Se descartarán los 14 movimientos leídos y no entrará nada a conciliación. Podrás volver a subir el PDF.',
    );
    const u = userEvent.setup();
    await u.click(
      within(dialogo).getByRole('button', { name: 'Sí, rechazar' }),
    );
    await u.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });

  it('con un solo movimiento habla en singular', () => {
    render(
      <ConfirmarRechazo
        total={1}
        onConfirmar={() => undefined}
        onCancelar={() => undefined}
      />,
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Se descartará el movimiento leído',
    );
  });
});

describe('BannerDecision', () => {
  it('aceptada: título con la cuenta que dijo el servidor y dos enlaces', () => {
    enRuta(<BannerDecision accion="aceptar" movimientos={14} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(
      'Importación aceptada. Los 14 movimientos entraron a conciliación.',
    );
    expect(banner).toHaveTextContent(
      'El motor corre al terminar. Los casos aparecerán en la bandeja.',
    );
    expect(
      within(banner).getByRole('link', { name: 'Ir a la bandeja' }),
    ).toHaveAttribute('href', '/bandeja');
    expect(
      within(banner).getByRole('link', { name: 'Volver a Cargas' }),
    ).toHaveAttribute('href', '/cargas');
  });

  it('aceptada con un movimiento, o sin conteo, no inventa cifras', () => {
    const { unmount } = enRuta(
      <BannerDecision accion="aceptar" movimientos={1} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Importación aceptada. El movimiento entró a conciliación.',
    );
    unmount();
    enRuta(<BannerDecision accion="aceptar" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Importación aceptada. Los movimientos entraron a conciliación.',
    );
  });

  it('rechazada: sin enlace a la bandeja', () => {
    enRuta(<BannerDecision accion="rechazar" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Vista previa rechazada.');
    expect(banner).toHaveTextContent(
      'No entró ningún movimiento a conciliación. Puedes volver a subir el mismo PDF si lo necesitas.',
    );
    expect(
      within(banner).queryByRole('link', { name: 'Ir a la bandeja' }),
    ).not.toBeInTheDocument();
    expect(
      within(banner).getByRole('link', { name: 'Volver a Cargas' }),
    ).toHaveAttribute('href', '/cargas');
  });
});

describe('EstadoVistaPrevia', () => {
  it.each([
    ['espera', 'Pendiente de vista previa', 'neutral'],
    ['aceptando', 'Importando', 'sugerencia'],
    ['rechazando', 'Rechazando', 'sin_match'],
    ['aceptada', 'Procesada', 'conciliado'],
    ['rechazada', 'Rechazada', 'sin_match'],
  ] as const)('%s: «%s» con tono %s', (fase, texto, tono) => {
    render(<EstadoVistaPrevia fase={fase} />);
    expect(screen.getByText(texto)).toHaveAttribute('data-tono', tono);
  });
});
