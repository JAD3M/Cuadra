import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacion } from './Paginacion';

function montar(pagina: number, total: number, limite = 20) {
  const onIr = vi.fn();
  const { container } = render(
    <Paginacion pagina={pagina} total={total} limite={limite} onIr={onIr} />,
  );
  return { onIr, container };
}

describe('Paginacion: navegación', () => {
  it('es una navegación llamada "Paginación"', () => {
    montar(1, 39);
    expect(
      screen.getByRole('navigation', { name: 'Paginación' }),
    ).toBeVisible();
  });

  it('en la primera página "anterior" está deshabilitado y "siguiente" no', () => {
    montar(1, 39);
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }),
    ).toBeEnabled();
  });

  it('en la última "siguiente" está deshabilitado y "anterior" no', () => {
    montar(2, 39);
    expect(
      screen.getByRole('button', { name: 'Página anterior' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Página siguiente' }),
    ).toBeDisabled();
  });

  it('aria-current="page" solo en la página actual', () => {
    montar(2, 39);
    const actuales = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(actuales).toHaveLength(1);
    expect(actuales[0]).toHaveTextContent('2');
  });

  it('los clics llaman a onIr con la página destino', async () => {
    const { onIr } = montar(2, 100);
    await userEvent.click(
      screen.getByRole('button', { name: 'Página anterior' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Página siguiente' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onIr).toHaveBeenNthCalledWith(1, 1);
    expect(onIr).toHaveBeenNthCalledWith(2, 3);
    expect(onIr).toHaveBeenNthCalledWith(3, 5);
  });

  it('un clic sobre la página actual no navega', async () => {
    const { onIr } = montar(1, 39);
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    expect(onIr).not.toHaveBeenCalled();
  });

  it('con muchas páginas muestra elipsis decorativas y pocos controles', () => {
    montar(50, 2000);
    const botones = screen.getAllByRole('button');
    // anterior + cinco páginas de la ventana (dos son elipsis) + siguiente
    expect(botones).toHaveLength(7);
    expect(screen.getAllByText('…')[0]).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Paginacion: rango visible y anunciado', () => {
  it('el rango visible es aria-hidden y el estado lo anuncia completo', () => {
    montar(2, 39);
    const visible = screen.getByText('21–39 de 39');
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    const estado = screen.getByRole('status');
    expect(
      within(estado).getByText('Mostrando 21–39 de 39'),
    ).toBeInTheDocument();
    expect(estado).not.toHaveAttribute('aria-hidden');
  });

  it('primera página: 1–20 de 39', () => {
    montar(1, 39);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Mostrando 1–20 de 39',
    );
    expect(screen.getByText('1–20 de 39')).toBeInTheDocument();
  });

  it('una sola página muestra 1–7 de 7 y ningún botón', () => {
    montar(1, 7);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 1–7 de 7');
    expect(screen.getByText('1–7 de 7')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('el rango de la última página no pasa del total', () => {
    montar(3, 41);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Mostrando 41–41 de 41',
    );
  });

  it('total 0: "Sin resultados" y ningún control', () => {
    montar(1, 0);
    expect(screen.getByRole('status')).toHaveTextContent('Sin resultados');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('el estado es cortés: role=status y no alert', () => {
    montar(1, 39);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
