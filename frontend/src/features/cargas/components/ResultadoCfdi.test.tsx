import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultadoCfdi } from './ResultadoCfdi';

const ARCHIVOS = [
  { archivo: 'a.xml', resultado: 'nuevo' as const },
  { archivo: 'b.xml', resultado: 'ya_existia' as const },
  {
    archivo: 'c.xml',
    resultado: 'error' as const,
    motivo: 'XML mal formado',
  },
];

function montar(archivos: Parameters<typeof ResultadoCfdi>[0]['archivos']) {
  return render(
    <ResultadoCfdi
      nuevos={1}
      existentes={1}
      conError={1}
      archivos={archivos}
    />,
  );
}

describe('ResultadoCfdi', () => {
  it('el resumen dice cuántos nuevos, cuántos ya existían y cuántos con error', () => {
    montar(ARCHIVOS);
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === '1 nuevos, 1 ya existían, 1 con error.',
      ),
    ).toBeInTheDocument();
  });

  it('cada cifra del resumen va en su propio elemento que no se parte', () => {
    montar(ARCHIVOS);
    const resumen = screen.getByText(
      (_, el) => el?.tagName === 'P' && /nuevos/.test(el.textContent ?? ''),
    );
    const cifras = within(resumen).getAllByText('1');
    expect(cifras).toHaveLength(3);
    for (const cifra of cifras) {
      expect(cifra.tagName).toBe('SPAN');
      expect(cifra.className).toMatch(/cifra/);
    }
  });

  it('una entrada por archivo con su estado en texto', () => {
    montar(ARCHIVOS);
    const lista = screen.getByRole('list');
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('a.xml');
    expect(filas[0]).toHaveTextContent('Nuevo');
    expect(filas[1]).toHaveTextContent('b.xml');
    expect(filas[1]).toHaveTextContent('Ya existía');
    expect(filas[2]).toHaveTextContent('c.xml');
    expect(filas[2]).toHaveTextContent('Con error');
  });

  it('cada entrada lleva el tono de su resultado: ok, neutro y peligro', () => {
    montar(ARCHIVOS);
    expect(
      screen.getAllByRole('listitem').map((f) => f.getAttribute('data-tono')),
    ).toEqual(['ok', 'neutro', 'peligro']);
  });

  it('el motivo del error se muestra y solo en el archivo con error', () => {
    montar(ARCHIVOS);
    const filas = screen.getAllByRole('listitem');
    expect(filas[2]).toHaveTextContent('XML mal formado');
    expect(filas[0]).not.toHaveTextContent('XML mal formado');
    expect(filas[1]).not.toHaveTextContent('XML mal formado');
  });

  it('un error sin motivo no pinta un detalle vacío', () => {
    montar([{ archivo: 'c.xml', resultado: 'error' as const, motivo: '' }]);
    const fila = screen.getByRole('listitem');
    expect(fila.querySelectorAll('[data-motivo]')).toHaveLength(0);
  });

  it('el motivo y el nombre son texto plano: nada de img ni b (8.7)', () => {
    const { container } = montar([
      {
        archivo: '<b>x</b>.xml',
        resultado: 'error' as const,
        motivo: '<img src=x onerror=alert(1)>',
      },
    ]);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>x</b>.xml')).toBeInTheDocument();
    expect(
      screen.getByText('<img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
  });

  it('la lista está en una región con nombre, enfocable y fuera del anuncio en vivo', () => {
    montar(ARCHIVOS);
    const region = screen.getByRole('region', {
      name: 'Resultado por archivo',
    });
    expect(region).toHaveAttribute('tabindex', '0');
    // Cientos de archivos no se leen enteros cada vez que el panel cambia.
    expect(region).toHaveAttribute('aria-live', 'off');
  });

  it('los iconos son decorativos y el estado nunca depende del color', () => {
    montar(ARCHIVOS);
    for (const fila of screen.getAllByRole('listitem')) {
      expect(fila.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('sin archivos solo queda el resumen', () => {
    montar([]);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('no hay control para cerrar el panel (M13)', () => {
    montar(ARCHIVOS);
    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('moneda no soportada (3.1)', () => {
    const CON_MARCA = [
      {
        archivo: 'usd.xml',
        resultado: 'nuevo' as const,
        moneda: 'USD',
        monedaNoSoportada: true,
      },
      {
        archivo: 'eur.xml',
        resultado: 'ya_existia' as const,
        moneda: 'EUR',
        monedaNoSoportada: true,
      },
      { archivo: 'mxn.xml', resultado: 'nuevo' as const },
    ];
    const LEYENDA =
      '⚠ Se guardó, pero Cuadra no concilia monedas distintas de MXN.';

    it('el archivo marcado lleva su etiqueta con el código, en texto y bajo el nombre', () => {
      montar(CON_MARCA);
      const filas = within(screen.getByRole('list')).getAllByRole('listitem');
      expect(filas[0]).toHaveTextContent('⚠ Moneda no soportada · USD');
      expect(filas[1]).toHaveTextContent('⚠ Moneda no soportada · EUR');
      expect(filas[2]).not.toHaveTextContent('Moneda no soportada');
      // La carga y el archivo siguen con su estado de siempre.
      expect(filas[0]).toHaveTextContent('Nuevo');
      expect(filas[1]).toHaveTextContent('Ya existía');
    });

    it('la leyenda sale una sola vez, después de la lista, solo si hay alguna marca', () => {
      montar(CON_MARCA);
      const leyendas = screen.getAllByText(LEYENDA);
      expect(leyendas).toHaveLength(1);
      expect(
        screen
          .getByRole('list')
          .compareDocumentPosition(leyendas[0] as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('sin ninguna marca no hay etiqueta ni leyenda', () => {
      montar(ARCHIVOS);
      expect(screen.queryByText(/Moneda no soportada/)).toBeNull();
      expect(screen.queryByText(LEYENDA)).toBeNull();
    });
  });
});
