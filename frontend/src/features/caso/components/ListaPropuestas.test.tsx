import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListaPropuestas, type PropuestaFila } from './ListaPropuestas';

function fila(n: number, o: Partial<PropuestaFila> = {}): PropuestaFila {
  return {
    conciliacionId: `c-${n}`,
    regla: 'monto_unico',
    cfdi: {
      uuidFiscal: `UUID-${n}-0000-0000`,
      serie: 'A',
      folio: String(1040 + n),
      nombreEmisor: `Emisor ${n} SA`,
      total: '18560.4000',
      moneda: 'MXN',
    },
    ...o,
  };
}

const PROPUESTAS = [fila(1), fila(2), fila(3)];

describe('ListaPropuestas', () => {
  it('es una lista con una fila por propuesta que no está expandida', () => {
    render(
      <ListaPropuestas
        propuestas={PROPUESTAS}
        seleccionadaId="c-1"
        onSeleccionar={() => undefined}
      />,
    );
    const lista = screen.getByRole('list');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Emisor 1 SA')).toBeNull();
    expect(screen.getByText('Emisor 2 SA')).toBeInTheDocument();
    expect(screen.getByText('Emisor 3 SA')).toBeInTheDocument();
  });

  it('cada fila colapsada muestra etiqueta del CFDI, monto, regla y emisor', () => {
    render(
      <ListaPropuestas
        propuestas={[fila(1), fila(2, { regla: 'llm_sugerencia' })]}
        seleccionadaId="c-1"
        onSeleccionar={() => undefined}
      />,
    );
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(1);
    const [segunda] = filas;
    if (!segunda) throw new Error('sin fila');
    expect(within(segunda).getByText('Emisor 2 SA')).toBeInTheDocument();
    expect(within(segunda).getByText('$18,560.40')).toBeInTheDocument();
    expect(within(segunda).getAllByText('A-1042').length).toBeGreaterThan(0);
    expect(screen.getByText('llm_sugerencia')).toBeInTheDocument();
  });

  it('el botón se llama «Ver propuesta {serie-folio}» y está colapsado', () => {
    render(
      <ListaPropuestas
        propuestas={PROPUESTAS}
        seleccionadaId="c-1"
        onSeleccionar={() => undefined}
      />,
    );
    const boton = screen.getByRole('button', { name: 'Ver propuesta A-1042' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton.textContent).toContain('Ver propuesta');
  });

  it('sin serie ni folio la etiqueta es el UUID corto', () => {
    render(
      <ListaPropuestas
        propuestas={[
          fila(1),
          fila(2, {
            cfdi: {
              uuidFiscal: 'ABCDEF12-3456',
              serie: null,
              folio: null,
              nombreEmisor: null,
              total: '10.0000',
              moneda: 'MXN',
            },
          }),
        ]}
        seleccionadaId="c-1"
        onSeleccionar={() => undefined}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Ver propuesta ABCDEF12' }),
    ).toBeInTheDocument();
  });

  it('un clic expande: avisa con el id de la propuesta', async () => {
    const onSeleccionar = vi.fn();
    render(
      <ListaPropuestas
        propuestas={PROPUESTAS}
        seleccionadaId="c-1"
        onSeleccionar={onSeleccionar}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver propuesta A-1043' }),
    );
    expect(onSeleccionar).toHaveBeenCalledExactlyOnceWith('c-3');
  });

  it('con el teclado (Enter y espacio) también expande', async () => {
    const onSeleccionar = vi.fn();
    render(
      <ListaPropuestas
        propuestas={PROPUESTAS}
        seleccionadaId="c-1"
        onSeleccionar={onSeleccionar}
      />,
    );
    await userEvent.tab();
    expect(
      screen.getByRole('button', { name: 'Ver propuesta A-1042' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onSeleccionar).toHaveBeenCalledTimes(2);
    expect(onSeleccionar).toHaveBeenNthCalledWith(1, 'c-2');
  });

  it('con una sola propuesta no dibuja la lista', () => {
    const { container } = render(
      <ListaPropuestas
        propuestas={[fila(1)]}
        seleccionadaId="c-1"
        onSeleccionar={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
