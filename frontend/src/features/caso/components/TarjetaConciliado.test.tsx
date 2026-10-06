import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarjetaConciliado } from './TarjetaConciliado';

// 2026-10-05T10:00Z cae el 5 de octubre en cualquier zona de México.
const INSTANTE = '2026-10-05T18:00:00.000Z';

describe('TarjetaConciliado', () => {
  it('muestra quién confirmó y cuándo, y que el caso está cerrado', () => {
    render(<TarjetaConciliado usuario="Ana" confirmadaAt={INSTANTE} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Confirmado por Ana el \d{4}-\d{2}-\d{2}\.$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Este caso ya está cerrado y no admite cambios.'),
    ).toBeInTheDocument();
  });

  it('la fecha sale del instante en la zona del navegador', () => {
    render(<TarjetaConciliado usuario="Ana" confirmadaAt={INSTANTE} />);
    expect(screen.getByText(/el 2026-10-0[56]\./)).toBeInTheDocument();
  });

  it('sin usuario o sin fecha dice solo lo que el servidor devolvió', () => {
    const { rerender } = render(
      <TarjetaConciliado usuario={null} confirmadaAt={INSTANTE} />,
    );
    expect(screen.getByText(/^Confirmado el \d{4}-/)).toBeInTheDocument();
    rerender(<TarjetaConciliado usuario="Ana" confirmadaAt={null} />);
    expect(screen.getByText('Confirmado por Ana.')).toBeInTheDocument();
    rerender(<TarjetaConciliado usuario={null} confirmadaAt={null} />);
    expect(screen.queryByText(/Confirmado/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('no tiene controles de decisión, tampoco para un administrador', () => {
    render(<TarjetaConciliado usuario="Ana" confirmadaAt={INSTANTE} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Confirmar conciliación/)).toBeNull();
    expect(screen.queryByText(/Rechazar/)).toBeNull();
  });
});
