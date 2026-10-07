import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TarjetaValor } from './TarjetaValor';

const PARRAFO =
  'Si la referencia coincide y el monto difiere hasta este valor, el motor todavía propone el cruce y lo marca con la diferencia. En otra moneda la tolerancia es cero.';

describe('TarjetaValor listo', () => {
  it.each([
    ['0.5000', '$0.50'],
    ['0.0050', '$0.005'],
    ['1.2340', '$1.234'],
    ['12.3456', '$12.3456'],
    ['0.0000', '$0.00'],
    ['100.0000', '$100.00'],
  ])('%s se muestra exacto como %s (TOL-1.1-1.4)', (valor, esperado) => {
    render(<TarjetaValor estado={{ tipo: 'listo', valor }} />);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('el monto va en UN solo elemento, con la moneda aparte (TOL-1.7)', () => {
    render(<TarjetaValor estado={{ tipo: 'listo', valor: '12.3456' }} />);
    const monto = screen.getByText('$12.3456');
    expect(monto.children).toHaveLength(0);
    expect(screen.getByText('MXN')).not.toBe(monto);
    expect(monto.parentElement).toContainElement(screen.getByText('MXN'));
  });

  it('un decimal exacto nunca pasa por el formateador de dos decimales', () => {
    render(<TarjetaValor estado={{ tipo: 'listo', valor: '0.0050' }} />);
    expect(screen.queryByText('$0.01')).toBeNull();
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('un valor fuera de formato se muestra tal cual, sin romper (defensivo)', () => {
    render(<TarjetaValor estado={{ tipo: 'listo', valor: 'abc' }} />);
    expect(screen.getByText('$abc')).toBeInTheDocument();
  });

  it('es una sección nombrada «Valor actual» y trae el párrafo', () => {
    render(<TarjetaValor estado={{ tipo: 'listo', valor: '0.5000' }} />);
    const seccion = screen.getByRole('region', { name: 'Valor actual' });
    expect(
      within(seccion).getByRole('heading', { level: 2, name: 'Valor actual' }),
    ).toBeInTheDocument();
    expect(within(seccion).getByText(PARRAFO)).toBeInTheDocument();
  });

  it('pinta el hueco de contenido (formulario o aviso) bajo el párrafo', () => {
    render(
      <TarjetaValor estado={{ tipo: 'listo', valor: '0.5000' }}>
        <p>contenido del hueco</p>
      </TarjetaValor>,
    );
    const parrafo = screen.getByText(PARRAFO);
    const hueco = screen.getByText('contenido del hueco');
    expect(
      parrafo.compareDocumentPosition(hueco) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('TarjetaValor cargando', () => {
  it('esqueleto en región de estado con texto para lectores (TOL-2.1)', () => {
    render(<TarjetaValor estado={{ tipo: 'cargando' }} />);
    const estado = screen.getByRole('status');
    expect(estado).toHaveTextContent('Cargando la tolerancia');
    expect(screen.queryByText('MXN')).toBeNull();
    expect(screen.queryByText(PARRAFO)).toBeNull();
  });

  it('no pinta el hueco: no hay formulario mientras carga (TOL-2.1)', () => {
    render(
      <TarjetaValor estado={{ tipo: 'cargando' }}>
        <input aria-label="campo" />
      </TarjetaValor>,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('conserva el encabezado de la tarjeta', () => {
    render(<TarjetaValor estado={{ tipo: 'cargando' }} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Valor actual' }),
    ).toBeInTheDocument();
  });
});

describe('TarjetaValor error', () => {
  it('conexión: alerta con copy compartido y «Reintentar» que reintenta (TOL-2.2)', async () => {
    const onReintentar = vi.fn();
    render(
      <TarjetaValor
        estado={{ tipo: 'error', clase: 'conexion' }}
        onReintentar={onReintentar}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin permiso: copy compartido y sin «Reintentar» (TOL-2.3)', () => {
    render(
      <TarjetaValor
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

  it('otro estado o contrato: título genérico y nada del servidor (TOL-2.4)', async () => {
    const onReintentar = vi.fn();
    render(
      <TarjetaValor
        estado={{ tipo: 'error', clase: 'otro' }}
        onReintentar={onReintentar}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).not.toHaveTextContent('conectar');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('con error no hay monto, párrafo ni hueco de formulario', () => {
    render(
      <TarjetaValor estado={{ tipo: 'error', clase: 'conexion' }}>
        <input aria-label="campo" />
      </TarjetaValor>,
    );
    expect(screen.queryByText('MXN')).toBeNull();
    expect(screen.queryByText(PARRAFO)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('conexión sin función de reintento no inventa el botón', () => {
    render(<TarjetaValor estado={{ tipo: 'error', clase: 'conexion' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
