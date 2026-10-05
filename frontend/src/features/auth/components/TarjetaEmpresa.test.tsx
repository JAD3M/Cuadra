import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TarjetaEmpresa, type TarjetaEmpresaProps } from './TarjetaEmpresa';

function montar(extra: Partial<TarjetaEmpresaProps> = {}) {
  const onElegir = vi.fn();
  render(
    <TarjetaEmpresa
      razonSocial="Ferretería del Bajío"
      rfc="FDB190215QK4"
      roles={['contador']}
      tono="sugerencia"
      onElegir={onElegir}
      {...extra}
    />,
  );
  return { onElegir };
}

describe('TarjetaEmpresa', () => {
  it('es un botón cuyo nombre contiene la razón social y el RFC', () => {
    montar();
    const boton = screen.getByRole('button', {
      name: /Ferretería del Bajío.*FDB190215QK4/,
    });
    expect(boton).toHaveAttribute('type', 'button');
  });

  it('muestra las iniciales como mosaico decorativo', () => {
    montar();
    const mosaico = screen.getByText('FB');
    expect(mosaico).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button').textContent).toContain('FB');
  });

  it('el nombre accesible no incluye las iniciales', () => {
    montar();
    expect(
      screen.getByRole('button', { name: /^Ferretería del Bajío/ }),
    ).toBeInTheDocument();
  });

  it('muestra el RFC completo', () => {
    montar();
    expect(screen.getByText('FDB190215QK4')).toBeInTheDocument();
  });

  it('muestra los roles con su etiqueta y en orden fijo', () => {
    montar({ roles: ['revisor', 'admin', 'contador'] });
    const chips = screen
      .getAllByText(/Administrador|Contador|Revisor/)
      .map((chip) => chip.textContent);
    expect(chips).toEqual(['Administrador', 'Contador', 'Revisor']);
  });

  it('los chips usan el tono decorativo de la tarjeta', () => {
    montar({ tono: 'conciliado' });
    expect(screen.getByText('Contador')).toHaveAttribute(
      'data-tono',
      'conciliado',
    );
  });

  it('elige con clic', async () => {
    const { onElegir } = montar();
    await userEvent.setup().click(screen.getByRole('button'));
    expect(onElegir).toHaveBeenCalledTimes(1);
  });

  it('elige con Enter y con espacio', async () => {
    const { onElegir } = montar();
    const usuario = userEvent.setup();
    await usuario.tab();
    await usuario.keyboard('{Enter}');
    await usuario.keyboard(' ');
    expect(onElegir).toHaveBeenCalledTimes(2);
  });

  it('pendiente: dice "Entrando…", oculta los roles y no vuelve a elegir', async () => {
    const { onElegir } = montar({ pendiente: true });
    const boton = screen.getByRole('button');
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).toHaveTextContent('Entrando…');
    expect(screen.queryByText('Contador')).not.toBeInTheDocument();
    await userEvent.setup().click(boton);
    expect(onElegir).not.toHaveBeenCalled();
  });

  it('inactiva: aria-disabled, sigue en la tabulación y no elige', async () => {
    const { onElegir } = montar({ inactiva: true });
    const boton = screen.getByRole('button');
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(boton).not.toBeDisabled();
    const usuario = userEvent.setup();
    await usuario.tab();
    expect(boton).toHaveFocus();
    await usuario.keyboard('{Enter}');
    await usuario.click(boton);
    expect(onElegir).not.toHaveBeenCalled();
    expect(boton).toHaveTextContent('Contador');
  });

  it('activa no lleva aria-disabled', () => {
    montar();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
  });
});
