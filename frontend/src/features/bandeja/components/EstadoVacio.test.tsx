import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  VACIO_CON_FILTROS,
  VACIO_POR_DEFECTO,
} from '@/features/bandeja/textos';
import { EstadoVacio } from './EstadoVacio';

describe('EstadoVacio', () => {
  it('con filtros explica y ofrece restablecerlos', async () => {
    const onRestablecer = vi.fn();
    render(<EstadoVacio conFiltros onRestablecer={onRestablecer} />);
    expect(screen.getByText(VACIO_CON_FILTROS.titulo)).toBeInTheDocument();
    expect(screen.getByText(VACIO_CON_FILTROS.detalle)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(onRestablecer).toHaveBeenCalledOnce();
  });

  it('con la vista por defecto no ofrece ninguna acción', () => {
    render(<EstadoVacio conFiltros={false} onRestablecer={vi.fn()} />);
    expect(screen.getByText(VACIO_POR_DEFECTO.titulo)).toBeInTheDocument();
    expect(screen.getByText(VACIO_POR_DEFECTO.detalle)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
