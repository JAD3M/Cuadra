import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ESTADOS_BANDEJA,
  ESTADOS_POR_DEFECTO,
  type EstadoBandeja,
} from '@/shared/dominio/bandeja';
import { ETIQUETAS_ESTADO_BANDEJA } from '@/shared/dominio/etiquetas';
import { FiltrosEstado } from './FiltrosEstado';

function montar(estados: readonly EstadoBandeja[] = ESTADOS_POR_DEFECTO) {
  const onAlternar = vi.fn();
  render(<FiltrosEstado estados={estados} onAlternar={onAlternar} />);
  return { onAlternar };
}

function chip(estado: EstadoBandeja): HTMLElement {
  return screen.getByRole('button', { name: ETIQUETAS_ESTADO_BANDEJA[estado] });
}

describe('FiltrosEstado: estructura', () => {
  it('agrupa tres chips con la etiqueta del espejo y en su orden', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Filtrar por estado' });
    const botones = within(grupo).getAllByRole('button');
    expect(botones.map((b) => b.textContent)).toEqual(
      ESTADOS_BANDEJA.map((e) => ETIQUETAS_ESTADO_BANDEJA[e]),
    );
  });

  it('aria-pressed refleja los estados activos', () => {
    montar(['sugerencia', 'sin_match']);
    expect(chip('sugerencia')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('sin_match')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('conciliado')).toHaveAttribute('aria-pressed', 'false');
  });

  it('publica el orden fijo como texto visible junto a los filtros', () => {
    montar();
    expect(screen.getByText('Orden: monto ↓')).toBeVisible();
  });
});

describe('FiltrosEstado: interacción', () => {
  it('un clic llama a onAlternar con el estado', async () => {
    const { onAlternar } = montar();
    await userEvent.click(chip('conciliado'));
    expect(onAlternar).toHaveBeenCalledExactlyOnceWith('conciliado');
  });

  it('Enter y Espacio alternan el chip enfocado', async () => {
    const { onAlternar } = montar();
    chip('conciliado').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onAlternar).toHaveBeenCalledTimes(2);
    expect(onAlternar).toHaveBeenNthCalledWith(1, 'conciliado');
    expect(onAlternar).toHaveBeenNthCalledWith(2, 'conciliado');
  });

  it('con varios activos no hay aviso ni chip deshabilitado', () => {
    montar(['sugerencia', 'sin_match']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    for (const estado of ESTADOS_BANDEJA) {
      expect(chip(estado)).not.toHaveAttribute('aria-disabled');
      expect(chip(estado)).not.toHaveAttribute('aria-describedby');
    }
  });
});

describe('FiltrosEstado: último filtro activo', () => {
  it('muestra la línea de estado visible y la ata al chip activo', () => {
    montar(['sin_match']);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Debe quedar al menos un estado activo.');
    expect(aviso).toBeVisible();
    expect(chip('sin_match')).toHaveAttribute('aria-describedby', aviso.id);
    expect(aviso.id).not.toBe('');
  });

  it('el último chip queda aria-disabled, enfocable y sin efecto', async () => {
    const { onAlternar } = montar(['sin_match']);
    const ultimo = chip('sin_match');
    expect(ultimo).toHaveAttribute('aria-disabled', 'true');
    expect(ultimo).not.toBeDisabled();
    await userEvent.click(ultimo);
    ultimo.focus();
    expect(ultimo).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onAlternar).not.toHaveBeenCalled();
  });

  it('los chips inactivos siguen respondiendo', async () => {
    const { onAlternar } = montar(['sin_match']);
    await userEvent.click(chip('conciliado'));
    expect(onAlternar).toHaveBeenCalledExactlyOnceWith('conciliado');
    expect(chip('conciliado')).not.toHaveAttribute('aria-describedby');
  });
});
