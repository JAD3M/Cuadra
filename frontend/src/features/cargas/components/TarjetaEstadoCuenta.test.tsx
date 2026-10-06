import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERFILES } from '@/test/fixturesCargas';
import { TarjetaEstadoCuenta } from './TarjetaEstadoCuenta';

const MB = 1024 * 1024;

function csv(nombre: string, tamano = 186 * 1024): File {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'size', { value: tamano });
  return f;
}

interface Opciones {
  inicial?: File | null;
  sinPerfiles?: boolean;
  deshabilitada?: boolean;
  subiendo?: boolean;
}

function montar({
  inicial = null,
  sinPerfiles = false,
  deshabilitada = false,
  subiendo = false,
}: Opciones = {}) {
  const perfiles = sinPerfiles ? undefined : PERFILES;
  const onSubir = vi.fn();
  const alPerfil = vi.fn();
  const regionRef = createRef<HTMLDivElement>();
  function Arnes() {
    const [archivo, setArchivo] = useState<File | null>(inicial);
    const [banco, setBanco] = useState('');
    const [cuenta, setCuenta] = useState('');
    const [perfil, setPerfil] = useState<string | null>(
      perfiles ? 'cuadra' : null,
    );
    return (
      <TarjetaEstadoCuenta
        archivo={archivo}
        banco={banco}
        cuenta={cuenta}
        perfiles={perfiles}
        perfil={perfil}
        deshabilitada={deshabilitada}
        subiendo={subiendo}
        regionRef={regionRef}
        onSeleccionar={setArchivo}
        onBanco={setBanco}
        onCuenta={setCuenta}
        onPerfil={(id) => {
          alPerfil(id);
          setPerfil(id);
        }}
        onSubir={onSubir}
      />
    );
  }
  render(<Arnes />);
  return { onSubir, alPerfil, regionRef };
}

const usuario = () => userEvent.setup({ applyAccept: false });

describe('TarjetaEstadoCuenta', () => {
  it('encabezado, campos, límites y nota del mockup', () => {
    montar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Estado de cuenta' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Banco')).toHaveAttribute('maxlength', '128');
    expect(screen.getByLabelText('Cuenta')).toHaveAttribute('maxlength', '32');
    expect(screen.getByLabelText('Perfil de lectura')).toHaveValue('cuadra');
    expect(
      screen.getByText('Solo .csv · un archivo · hasta 10 MB'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El servidor vuelve a validar cada archivo: extensión, tamaño, que sea texto y que cumpla el formato. Nada de lo que subes se ejecuta.',
      ),
    ).toBeInTheDocument();
  });

  it('el selector es de un solo archivo y se llama «Elegir archivo»', () => {
    montar();
    const entrada = screen.getByLabelText('Elegir archivo');
    expect(entrada).not.toHaveAttribute('multiple');
    expect(entrada).toHaveAttribute('accept', '.csv');
  });

  it('sin archivo: sin fila y el botón apagado', () => {
    montar();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeDisabled();
  });

  it('el botón es el de tono sin match (naranja)', () => {
    montar();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toHaveAttribute('data-tono', 'sin_match');
  });

  it('un CSV válido: fila lista, botón activo y entrega el archivo', async () => {
    const { onSubir } = montar();
    const archivo = csv('estado-sep-2026.csv');
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), archivo);
    expect(screen.getByRole('listitem')).toHaveTextContent('Listo para subir');
    expect(screen.getByRole('listitem')).toHaveTextContent('186 KB');
    const boton = screen.getByRole('button', {
      name: 'Subir estado de cuenta',
    });
    expect(boton).toBeEnabled();
    await u.click(boton);
    expect(onSubir).toHaveBeenCalledWith(archivo);
  });

  it('movs.CSV en mayúsculas se acepta (5.8)', async () => {
    montar();
    await usuario().upload(
      screen.getByLabelText('Elegir archivo'),
      csv('movs.CSV'),
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('Listo para subir');
  });

  it('movs.xlsx se rechaza con «Solo se aceptan archivos .csv» y no se puede subir (5.8)', async () => {
    montar();
    await usuario().upload(
      screen.getByLabelText('Elegir archivo'),
      csv('movs.xlsx'),
    );
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Solo se aceptan archivos .csv',
    );
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeDisabled();
  });

  it('un CSV de más de 10 MB se rechaza con «El archivo pasa de 10 MB» (M4)', async () => {
    montar();
    await usuario().upload(
      screen.getByLabelText('Elegir archivo'),
      csv('estado-sep-2026.csv', 10 * MB + 1),
    );
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'El archivo pasa de 10 MB',
    );
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeDisabled();
  });

  it('una elección nueva reemplaza al archivo anterior (M16)', async () => {
    montar();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('uno.csv'));
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('dos.csv'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('dos.csv');
  });

  it('con la cuenta completa avisa y el botón sigue activo (6.2)', async () => {
    montar({ inicial: csv('estado.csv') });
    await usuario().type(screen.getByLabelText('Cuenta'), '012345678901234567');
    expect(
      screen.getByText(
        'Parece un número de cuenta completo. Escribe solo los últimos dígitos.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeEnabled();
  });

  it('elegir otro perfil entrega su id (M13)', async () => {
    const { alPerfil } = montar();
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText('Perfil de lectura'), 'banco-norte');
    expect(alPerfil).toHaveBeenCalledWith('banco-norte');
  });

  it('si los perfiles no cargaron el campo se oculta y el resto sigue (4.5)', () => {
    montar({ sinPerfiles: true, inicial: csv('estado.csv') });
    expect(screen.queryByLabelText('Perfil de lectura')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeEnabled();
  });

  it('solo lectura: cada control está deshabilitado, ninguno oculto (4.2)', () => {
    montar({ deshabilitada: true, inicial: csv('estado.csv') });
    expect(screen.getByLabelText('Banco')).toBeDisabled();
    expect(screen.getByLabelText('Cuenta')).toBeDisabled();
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivo')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ).toBeDisabled();
  });

  it('subiendo: el botón dice «Subiendo…» y la tarjeta entera se apaga (M13)', () => {
    montar({ subiendo: true, inicial: csv('estado.csv') });
    expect(screen.getByRole('button', { name: 'Subiendo…' })).toBeDisabled();
    expect(screen.getByLabelText('Banco')).toBeDisabled();
    expect(screen.getByLabelText('Cuenta')).toBeDisabled();
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivo')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Subiendo tus archivos',
    );
  });

  it('la región de estado es persistente y enfocable', () => {
    const { regionRef } = montar();
    const region = screen.getByRole('status');
    expect(region).toBe(regionRef.current);
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(region).toBeEmptyDOMElement();
  });
});
