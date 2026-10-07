import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TarjetaCambios, type FilaCambio } from './TarjetaCambios';

const fila = (n: number, parcial: Partial<FilaCambio> = {}): FilaCambio => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  antes: `$${n}.00`,
  despues: `$${n}.50`,
  quien: `Autor ${n}`,
  fecha: `2026-09-0${n} 10:00`,
  reciente: n === 1,
  ...parcial,
});

const cinco = [1, 2, 3, 4, 5].map((n) => fila(n));

describe('TarjetaCambios estructura', () => {
  it('es una sección nombrada «Cambios recientes» con su h2', () => {
    render(<TarjetaCambios estado={{ tipo: 'vacio' }} />);
    const seccion = screen.getByRole('region', { name: 'Cambios recientes' });
    expect(
      within(seccion).getByRole('heading', {
        level: 2,
        name: 'Cambios recientes',
      }),
    ).toBeInTheDocument();
  });
});

describe('TarjetaCambios cargando', () => {
  it('esqueleto en región de estado con texto para lectores (TOL-2.1)', () => {
    render(<TarjetaCambios estado={{ tipo: 'cargando' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando los cambios',
    );
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('TarjetaCambios vacío', () => {
  it('dice que aún no hay cambios y cuándo aparecerán (TOL-10.8)', () => {
    render(<TarjetaCambios estado={{ tipo: 'vacio' }} />);
    expect(screen.getByText('Aún no hay cambios.').tagName).toBe('STRONG');
    expect(
      screen.getByText(
        'Cuando un administrador cambie la tolerancia, aparecerá aquí.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('TarjetaCambios error', () => {
  it('conexión: alerta propia y «Reintentar» que llama solo a su reintento (TOL-10.9)', async () => {
    const onReintentar = vi.fn();
    render(
      <TarjetaCambios
        estado={{ tipo: 'error', clase: 'conexion' }}
        onReintentar={onReintentar}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar los cambios.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin permiso: copy compartido y sin «Reintentar»', () => {
    render(
      <TarjetaCambios
        estado={{ tipo: 'error', clase: 'sin_permiso' }}
        onReintentar={vi.fn()}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('otro: título genérico con «Reintentar», sin texto del servidor', async () => {
    const onReintentar = vi.fn();
    render(
      <TarjetaCambios
        estado={{ tipo: 'error', clase: 'otro' }}
        onReintentar={onReintentar}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo completar la solicitud.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin reintento declarado no hay botón', () => {
    render(<TarjetaCambios estado={{ tipo: 'error', clase: 'conexion' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('TarjetaCambios lista', () => {
  it('lista ordenada «Últimos 5 cambios» con cinco filas en orden (TOL-10.12)', () => {
    render(<TarjetaCambios estado={{ tipo: 'lista', filas: cinco }} />);
    const lista = screen.getByRole('list', { name: 'Últimos 5 cambios' });
    expect(lista.tagName).toBe('OL');
    const items = within(lista).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(
      items.map((li) => within(li).getByText(/^Autor/).textContent),
    ).toEqual(['Autor 1', 'Autor 2', 'Autor 3', 'Autor 4', 'Autor 5']);
  });

  it('cada fila muestra antes, despues, autor y fecha (TOL-10.3)', () => {
    render(<TarjetaCambios estado={{ tipo: 'lista', filas: [fila(1)] }} />);
    const [item] = screen.getAllByRole('listitem');
    expect(item).toHaveTextContent('$1.00');
    expect(item).toHaveTextContent('→');
    expect(item).toHaveTextContent('$1.50');
    expect(item).toHaveTextContent('Autor 1');
    expect(item).toHaveTextContent('2026-09-01 10:00');
  });

  it('el despues de la primera fila va resaltado y el de las demás atenuado (TOL-10.12)', () => {
    render(<TarjetaCambios estado={{ tipo: 'lista', filas: cinco }} />);
    expect(screen.getByText('$1.50').className).toMatch(/Reciente/);
    for (const resto of ['$2.50', '$3.50', '$4.50', '$5.50']) {
      expect(screen.getByText(resto).className).not.toMatch(/Reciente/);
    }
  });

  it('con solo tres coincidencias salen tres filas y ningún control de paginación (TOL-10.13)', () => {
    render(
      <TarjetaCambios estado={{ tipo: 'lista', filas: cinco.slice(0, 3) }} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('una persona sin nombre se ve como la raya que dio la derivación (TOL-10.4)', () => {
    render(
      <TarjetaCambios
        estado={{ tipo: 'lista', filas: [fila(1, { quien: '—' })] }}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('montos y fecha son elementos sueltos; el autor, aparte (TOL-10.5)', () => {
    render(<TarjetaCambios estado={{ tipo: 'lista', filas: [fila(1)] }} />);
    for (const texto of ['$1.00', '$1.50', '2026-09-01 10:00']) {
      expect(screen.getByText(texto).children).toHaveLength(0);
    }
    const autor = screen.getByText('Autor 1');
    expect(autor.className).toMatch(/autor/);
    expect(autor).not.toContain(screen.getByText('2026-09-01 10:00'));
  });
});

describe('TarjetaCambios sin enlace a la bitácora (TOL-10.11)', () => {
  const estados = [
    { tipo: 'cargando' },
    { tipo: 'vacio' },
    { tipo: 'error', clase: 'conexion' },
    { tipo: 'error', clase: 'sin_permiso' },
    { tipo: 'error', clase: 'otro' },
    { tipo: 'lista', filas: cinco },
  ] as const;

  it.each(estados)('estado %j', (estado) => {
    const { container } = render(
      <TarjetaCambios estado={estado} onReintentar={vi.fn()} />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('[href]')).toBeNull();
    expect(screen.queryByRole('button', { name: /bitácora/i })).toBeNull();
    expect(container).not.toHaveTextContent(/ver en la bitácora/i);
  });
});
