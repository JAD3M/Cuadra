import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Monto } from './Monto';
import { Tabla, Td, Th } from './Tabla';

function ejemplo() {
  return (
    <Tabla titulo="Movimientos bancarios">
      <thead>
        <tr>
          <Th>Fecha</Th>
          <Th numerica>Monto</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Th scope="row">12 ago</Th>
          <Td numerica>
            <Monto valor="-1234567890123.45" />
          </Td>
        </tr>
      </tbody>
    </Tabla>
  );
}

describe('Tabla', () => {
  it('usa marcado de tabla semántico con caption a partir del título', () => {
    render(ejemplo());
    const tabla = screen.getByRole('table', { name: 'Movimientos bancarios' });
    expect(tabla.querySelector('caption')).toHaveTextContent(
      'Movimientos bancarios',
    );
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(tabla).getAllByRole('row')).toHaveLength(2);
  });

  it('los encabezados de columna llevan scope col y los de fila scope row', () => {
    render(ejemplo());
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute(
      'scope',
      'col',
    );
    expect(screen.getByRole('rowheader', { name: '12 ago' })).toHaveAttribute(
      'scope',
      'row',
    );
  });

  it('el contenedor con scroll es una región enfocable con nombre', () => {
    render(ejemplo());
    const region = screen.getByRole('region', {
      name: 'Movimientos bancarios',
    });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toContainElement(screen.getByRole('table'));
  });

  it('la celda numérica contiene el monto completo en una sola pieza', () => {
    render(ejemplo());
    const celda = screen.getByRole('cell');
    expect(
      within(celda).getByText('−$1,234,567,890,123.45'),
    ).toBeInTheDocument();
  });

  it('reenvía atributos nativos a las celdas', () => {
    render(
      <Tabla titulo="Cargas">
        <tbody>
          <tr>
            <Td colSpan={2}>Sin filas</Td>
          </tr>
        </tbody>
      </Tabla>,
    );
    expect(screen.getByRole('cell', { name: 'Sin filas' })).toHaveAttribute(
      'colspan',
      '2',
    );
  });
});
