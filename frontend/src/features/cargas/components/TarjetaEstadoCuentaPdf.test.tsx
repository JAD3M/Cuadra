import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERFILES } from '@/test/fixturesCargas';
import {
  TarjetaEstadoCuenta,
  type TarjetaEstadoCuentaProps,
} from './TarjetaEstadoCuenta';

const MB = 1024 * 1024;

function archivo(nombre: string, tamano = 186 * 1024): File {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'size', { value: tamano });
  return f;
}

const BASE: TarjetaEstadoCuentaProps = {
  archivo: null,
  banco: '',
  cuenta: '',
  perfiles: PERFILES,
  perfil: 'cuadra',
  perfilesFallo: false,
  deshabilitada: false,
  subiendo: false,
  onSeleccionar: () => undefined,
  onBanco: () => undefined,
  onCuenta: () => undefined,
  onPerfil: () => undefined,
  onReintentarPerfiles: () => undefined,
  onSubir: () => undefined,
};

const montarPdf = (props: Partial<TarjetaEstadoCuentaProps> = {}) =>
  render(<TarjetaEstadoCuenta {...BASE} modo="pdf" {...props} />);

const usuario = () => userEvent.setup({ applyAccept: false });

describe('TarjetaEstadoCuenta: selector de formato', () => {
  it('CSV es el modo por omisión y marca su botón como activo', () => {
    render(<TarjetaEstadoCuenta {...BASE} />);
    const grupo = screen.getByRole('group', {
      name: 'Formato del estado de cuenta',
    });
    expect(within(grupo).getByRole('button', { name: 'CSV' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(grupo).getByRole('button', { name: 'PDF BBVA' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('en modo PDF el botón PDF BBVA queda activo', () => {
    montarPdf();
    expect(screen.getByRole('button', { name: 'PDF BBVA' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'CSV' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('elegir un formato avisa al contenedor', async () => {
    const onModo = vi.fn();
    render(<TarjetaEstadoCuenta {...BASE} onModo={onModo} />);
    await usuario().click(screen.getByRole('button', { name: 'PDF BBVA' }));
    expect(onModo).toHaveBeenCalledWith('pdf');
  });

  it('mientras se lee, el selector queda apagado', () => {
    montarPdf({ subiendo: true });
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PDF BBVA' })).toBeDisabled();
  });
});

describe('TarjetaEstadoCuenta: modo PDF', () => {
  it('oculta Cuenta y Perfil; Banco es un select fijo con BBVA', () => {
    montarPdf();
    expect(screen.queryByLabelText('Cuenta')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Perfil de lectura'),
    ).not.toBeInTheDocument();
    const banco = screen.getByRole('combobox', { name: 'Banco' });
    expect(banco).toHaveValue('bbva');
    expect(within(banco).getAllByRole('option')).toHaveLength(1);
    expect(
      within(banco).getByRole('option', { name: 'BBVA' }),
    ).toBeInTheDocument();
  });

  it('acepta solo .pdf, con la ayuda del mockup', () => {
    montarPdf();
    expect(screen.getByLabelText('Elegir archivo')).toHaveAttribute(
      'accept',
      '.pdf',
    );
    expect(
      screen.getByText('Solo .pdf · un archivo · hasta 10 MB'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Solo \.csv/)).not.toBeInTheDocument();
  });

  it('muestra el aviso de solo lectura', () => {
    montarPdf();
    expect(
      screen.getByText('Solo lectura: no se importó nada.'),
    ).toBeInTheDocument();
  });

  it('el botón dice «Leer estado de cuenta» y espera un PDF válido', () => {
    montarPdf();
    expect(
      screen.getByRole('button', { name: 'Leer estado de cuenta' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Subir estado de cuenta' }),
    ).not.toBeInTheDocument();
  });

  it('con un PDF válido el botón envía ese archivo', async () => {
    const onSubir = vi.fn();
    const pdf = archivo('estado-sep-2026.pdf');
    montarPdf({ onSubir, archivo: pdf });
    const boton = screen.getByRole('button', { name: 'Leer estado de cuenta' });
    expect(boton).toBeEnabled();
    await usuario().click(boton);
    expect(onSubir).toHaveBeenCalledWith(pdf);
  });

  it('mientras lee, el botón dice «Leyendo…» y está apagado', () => {
    montarPdf({ archivo: archivo('estado.pdf'), subiendo: true });
    const boton = screen.getByRole('button', { name: 'Leyendo…' });
    expect(boton).toBeDisabled();
    expect(screen.queryByText('Subiendo…')).not.toBeInTheDocument();
    // No hay anuncio de «Subiendo tus archivos»: lo dice el resultado.
    expect(screen.queryByText('Subiendo tus archivos')).not.toBeInTheDocument();
  });

  it('un archivo con otra extensión se rechaza con el texto del mockup', () => {
    const onSubir = vi.fn();
    montarPdf({ archivo: archivo('movimientos.xlsx', 42 * 1024), onSubir });
    expect(
      screen.getByText('Solo se aceptan archivos .pdf'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Leer estado de cuenta' }),
    ).toBeDisabled();
    expect(onSubir).not.toHaveBeenCalled();
  });

  it('un .csv tampoco pasa en modo PDF', () => {
    montarPdf({ archivo: archivo('movs.csv') });
    expect(
      screen.getByText('Solo se aceptan archivos .pdf'),
    ).toBeInTheDocument();
  });

  it('un PDF de más de 10 MB se rechaza por tamaño', () => {
    montarPdf({
      archivo: archivo('estado-sep-2026.pdf', Math.round(10.4 * MB)),
    });
    expect(screen.getByText('El archivo pasa de 10 MB')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Leer estado de cuenta' }),
    ).toBeDisabled();
  });

  it('un PDF listo se muestra como elegido', () => {
    montarPdf({ archivo: archivo('estado-sep-2026.pdf') });
    expect(screen.getByText('estado-sep-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('Listo para subir')).toBeInTheDocument();
  });

  it('con rol de solo lectura todo queda deshabilitado, no oculto', () => {
    montarPdf({ deshabilitada: true, archivo: archivo('estado.pdf') });
    expect(screen.getByRole('combobox', { name: 'Banco' })).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivo')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Leer estado de cuenta' }),
    ).toBeDisabled();
  });

  it('el resultado y la alerta que pasa el contenedor se pintan en la tarjeta', () => {
    montarPdf({
      resultado: <p>resultado de prueba</p>,
      alerta: <div role="alert">alerta de prueba</div>,
    });
    expect(screen.getByText('resultado de prueba')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('alerta de prueba');
  });
});

describe('TarjetaEstadoCuenta: modo CSV sin cambios', () => {
  it('conserva campos, accept, ayuda y botón; sin aviso de solo lectura', () => {
    render(<TarjetaEstadoCuenta {...BASE} modo="csv" />);
    expect(screen.getByLabelText('Cuenta')).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil de lectura')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Banco' })).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir archivo')).toHaveAttribute(
      'accept',
      '.csv',
    );
    expect(
      screen.getByText('Solo .csv · un archivo · hasta 10 MB'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Solo lectura: no se importó nada.'),
    ).not.toBeInTheDocument();
  });
});
