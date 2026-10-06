import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { itemCarga, LISTA_CINCO_ESTADOS } from '@/test/fixturesCargas';
import { TablaCargas } from './TablaCargas';

describe('TablaCargas', () => {
  it('publica las ocho columnas en el orden de K2, todas scope=col (2.1)', () => {
    render(<TablaCargas cargas={LISTA_CINCO_ESTADOS} />);
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados.map((e) => e.textContent)).toEqual([
      'Tipo',
      'Archivo',
      'Estado',
      'Avance',
      'Válidos',
      'Con error',
      'Subió',
      'Fecha',
    ]);
    for (const e of encabezados) expect(e).toHaveAttribute('scope', 'col');
  });

  it('no tiene columna «Ya existían» ni controles de orden', () => {
    render(<TablaCargas cargas={LISTA_CINCO_ESTADOS} />);
    expect(screen.queryByText(/Ya existían/)).toBeNull();
    for (const e of screen.getAllByRole('columnheader')) {
      expect(within(e).queryByRole('button')).toBeNull();
      expect(e).not.toHaveAttribute('aria-sort');
    }
  });

  it('es una región con nombre, enfocable para hacer scroll', () => {
    render(<TablaCargas cargas={LISTA_CINCO_ESTADOS} />);
    const region = screen.getByRole('region', { name: 'Historial de cargas' });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('una fila por carga, en el orden en que llegaron (2.2)', () => {
    render(<TablaCargas cargas={LISTA_CINCO_ESTADOS} />);
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(5);
    const chips = [
      'Pendiente',
      'Procesando',
      'Procesada',
      'Con errores',
      'Fallida',
    ];
    chips.forEach((chip, i) => {
      expect(
        within(filas[i] as HTMLElement).getByText(chip),
      ).toBeInTheDocument();
    });
  });

  it('conserva el orden recibido aunque las fechas no lo sigan', () => {
    const cargas = [itemCarga(9), itemCarga(1), itemCarga(5)];
    render(<TablaCargas cargas={cargas} />);
    const nombres = screen
      .getAllByRole('row')
      .slice(1)
      .map((f) => within(f).getAllByRole('cell')[1]?.textContent);
    expect(nombres).toEqual(['lote-9.xml', 'lote-1.xml', 'lote-5.xml']);
  });

  it('las filas no son clicables (2.5)', () => {
    render(<TablaCargas cargas={LISTA_CINCO_ESTADOS} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
