import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaRequiereRevision } from './TarjetaRequiereRevision';

// 2026-10-05T18:00Z cae el 5 de octubre en cualquier zona de México.
const INSTANTE = '2026-10-05T18:00:00.000Z';

describe('TarjetaRequiereRevision', () => {
  it('avisa que la factura fue cancelada y que Cuadra no reabre sola', () => {
    render(
      <TarjetaRequiereRevision
        etiquetaCfdi="A-1001"
        usuario="Ana"
        confirmadaAt={INSTANTE}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Requiere revisión' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'La factura A-1001 fue cancelada. Revisa esta conciliación.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^Cuadra no la reabre sola\. Confirmado por Ana el \d{4}-\d{2}-\d{2}\.$/,
      ),
    ).toBeInTheDocument();
  });

  it('sin usuario o sin fecha dice solo lo que el servidor devolvió', () => {
    const { rerender } = render(
      <TarjetaRequiereRevision
        etiquetaCfdi="A-1"
        usuario={null}
        confirmadaAt={null}
      />,
    );
    expect(screen.getByText('Cuadra no la reabre sola.')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).toBeNull();
    rerender(
      <TarjetaRequiereRevision
        etiquetaCfdi="A-1"
        usuario="Ana"
        confirmadaAt={null}
      />,
    );
    expect(
      screen.getByText('Cuadra no la reabre sola. Confirmado por Ana.'),
    ).toBeInTheDocument();
  });

  it('no tiene controles de decisión', () => {
    render(
      <TarjetaRequiereRevision
        etiquetaCfdi="A-1"
        usuario="Ana"
        confirmadaAt={INSTANTE}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
