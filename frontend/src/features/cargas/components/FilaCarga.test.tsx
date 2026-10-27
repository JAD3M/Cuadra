import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatearInstante } from '@/features/caso/fecha';
import type { EstadoCarga } from '@/shared/dominio';
import { itemCarga } from '@/test/fixturesCargas';
import { FilaCarga, type FilaHistorial } from './FilaCarga';

function montar(carga: FilaHistorial) {
  render(
    <table>
      <tbody>
        <FilaCarga carga={carga} />
      </tbody>
    </table>,
  );
  const fila = screen.getByRole('row');
  return { fila, celdas: within(fila).getAllByRole('cell') };
}

describe('FilaCarga', () => {
  it('pinta las ocho celdas en el orden de K2', () => {
    const carga = itemCarga(1, {
      nombreArchivo: 'lote-1.xml',
      registrosOk: 1204,
      registrosError: 3,
      estado: 'con_errores',
    });
    const { celdas } = montar(carga);
    expect(celdas).toHaveLength(8);
    expect(celdas[0]).toHaveTextContent('CFDI');
    expect(celdas[1]).toHaveTextContent('lote-1.xml');
    expect(celdas[2]).toHaveTextContent('Con filas rechazadas');
    expect(celdas[3]).toContainElement(
      screen.getByRole('img', { name: 'Avance: Con filas rechazadas' }),
    );
    expect(celdas[4]).toHaveTextContent('1204');
    expect(celdas[5]).toHaveTextContent('3');
    expect(celdas[6]).toHaveTextContent('Luis Mendoza');
    expect(celdas[7]).toHaveTextContent(formatearInstante(carga.createdAt));
  });

  it('la fecha es YYYY-MM-DD HH:mm en la zona del navegador (M6)', () => {
    const carga = itemCarga(2);
    const { celdas } = montar(carga);
    expect(celdas[7]?.textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(celdas[7]?.textContent).toBe(formatearInstante(carga.createdAt));
  });

  it('un estado de cuenta se etiqueta «Estado de cuenta»', () => {
    const { celdas } = montar(itemCarga(1, { tipo: 'estado_cuenta' }));
    expect(celdas[0]).toHaveTextContent('Estado de cuenta');
  });

  it.each<[EstadoCarga, string]>([
    ['pendiente', 'Pendiente'],
    ['procesando', 'Procesando'],
    ['procesada', 'Procesada'],
    ['con_errores', 'Con filas rechazadas'],
    ['fallida', 'Fallida'],
  ])('el chip de %s dice «%s» con su tono', (estado, etiqueta) => {
    const { celdas } = montar(itemCarga(1, { estado }));
    const chip = within(celdas[2] as HTMLElement).getByText(etiqueta);
    expect(chip).toBeInTheDocument();
    expect(chip.closest('[data-tono]')).not.toBeNull();
  });

  it('quien subió ausente se muestra «—» (2.3)', () => {
    const { celdas } = montar(itemCarga(1, { subidoPor: null }));
    expect(celdas[6]).toHaveTextContent('—');
  });

  it('cada contador está en un solo elemento, con el número tal como llegó (2.4)', () => {
    const { celdas } = montar(
      itemCarga(1, { registrosOk: 1204, registrosError: 3 }),
    );
    const ok = within(celdas[4] as HTMLElement).getByText('1204');
    const error = within(celdas[5] as HTMLElement).getByText('3');
    expect(ok.textContent).toBe('1204');
    expect(error.textContent).toBe('3');
    expect(ok.className).toContain('contador');
    expect(error.className).toContain('contador');
  });

  it.each<EstadoCarga>(['pendiente', 'procesando', 'fallida'])(
    'M12: una carga %s muestra «—» en Válidos y Con error aunque traiga ceros',
    (estado) => {
      const { celdas } = montar(
        itemCarga(1, { estado, registrosOk: 0, registrosError: 0 }),
      );
      expect(celdas[4]).toHaveTextContent('—');
      expect(celdas[5]).toHaveTextContent('—');
    },
  );

  it('M12: una carga fallida no resalta Con error aunque traiga un número', () => {
    const { celdas } = montar(
      itemCarga(1, { estado: 'fallida', registrosOk: 2, registrosError: 5 }),
    );
    expect(celdas[4]?.textContent).toBe('—');
    expect(celdas[5]?.textContent).toBe('—');
    const guion = within(celdas[5] as HTMLElement).getByText('—');
    expect(guion.className).not.toContain('conError');
  });

  it.each<EstadoCarga>(['procesada', 'con_errores'])(
    'M12: una carga %s muestra los contadores tal como llegaron, incluido 0',
    (estado) => {
      const { celdas } = montar(
        itemCarga(1, { estado, registrosOk: 0, registrosError: 0 }),
      );
      expect(celdas[4]?.textContent).toBe('0');
      expect(celdas[5]?.textContent).toBe('0');
    },
  );

  it('Con error resalta solo cuando es mayor que cero', () => {
    const con = montar(itemCarga(1, { registrosError: 3 }));
    const marcada = within(con.celdas[5] as HTMLElement).getByText('3');
    expect(marcada.className).toContain('conError');
    document.body.innerHTML = '';
    const sin = montar(itemCarga(1, { registrosError: 0 }));
    const normal = within(sin.celdas[5] as HTMLElement).getByText('0');
    expect(normal.className).not.toContain('conError');
  });

  it('la fila no es clicable: sin enlaces ni botones (2.5)', () => {
    const { fila } = montar(itemCarga(1));
    expect(within(fila).queryByRole('link')).toBeNull();
    expect(within(fila).queryByRole('button')).toBeNull();
    expect(fila).not.toHaveAttribute('onclick');
    expect(fila).not.toHaveAttribute('tabindex');
  });

  it('el nombre del archivo es texto plano, completo en el DOM y con title', () => {
    const nombre = '<b>x</b>.xml';
    const { fila, celdas } = montar(itemCarga(1, { nombreArchivo: nombre }));
    expect(fila.querySelector('b')).toBeNull();
    expect(celdas[1]).toHaveTextContent(nombre);
    expect(within(celdas[1] as HTMLElement).getByText(nombre)).toHaveAttribute(
      'title',
      nombre,
    );
  });

  it('un nombre largo de lote queda completo en el DOM', () => {
    const nombre = `48 archivos: ${'factura-A-1044.xml, '.repeat(20)}…`;
    const { celdas } = montar(itemCarga(1, { nombreArchivo: nombre }));
    expect(celdas[1]?.textContent).toBe(nombre);
  });
});
