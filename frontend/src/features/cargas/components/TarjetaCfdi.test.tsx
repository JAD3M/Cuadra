import { createRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TarjetaCfdi } from './TarjetaCfdi';

const MB = 1024 * 1024;

/** Un File de verdad con el tamaño que pide la prueba, sin reservar memoria. */
function archivo(nombre: string, tamano = 1024): File {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'size', { value: tamano });
  return f;
}

interface Opciones {
  inicial?: File[];
  deshabilitada?: boolean;
  subiendo?: boolean;
}

function montar({
  inicial = [],
  deshabilitada = false,
  subiendo = false,
}: Opciones = {}) {
  const onSubir = vi.fn();
  const alSeleccionar = vi.fn();
  const regionRef = createRef<HTMLDivElement>();
  function Arnes() {
    const [archivos, setArchivos] = useState<File[]>(inicial);
    return (
      <TarjetaCfdi
        archivos={archivos}
        deshabilitada={deshabilitada}
        subiendo={subiendo}
        regionRef={regionRef}
        onSeleccionar={(nuevos) => {
          alSeleccionar(nuevos);
          setArchivos(nuevos);
        }}
        onSubir={onSubir}
      />
    );
  }
  render(<Arnes />);
  return { onSubir, alSeleccionar, regionRef };
}

/** El selector del sistema filtra por `accept`; aquí hay que dejar pasar todo. */
const usuario = () => userEvent.setup({ applyAccept: false });

const PROPS_BASE = {
  archivos: [],
  deshabilitada: false,
  subiendo: false,
  onSeleccionar: () => undefined,
  onSubir: () => undefined,
};

const MEZCLA = () => [
  archivo('factura-A-1044.xml', 14 * 1024),
  archivo('factura-A-1045.xml', 12 * 1024),
  archivo('conciliar.py', 3 * 1024),
  archivo('respaldo-facturas.xml', 2 * MB + 1),
];

describe('TarjetaCfdi', () => {
  it('encabezado, zona y límites con el texto del mockup', () => {
    montar();
    expect(
      screen.getByRole('heading', { level: 2, name: 'CFDI · XML' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arrastra tus XML aquí')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Cada archivo se valida por separado. Un XML inválido no detiene a los demás.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Solo .xml · hasta 2 MB por archivo · máximo 500 archivos y 50 MB por carga',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir archivos')).toHaveAttribute(
      'multiple',
    );
  });

  it('sin selección: «0 archivos listos.», sin lista y el botón apagado (5.7)', () => {
    montar();
    expect(screen.getByText('0 archivos listos.')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Archivos elegidos' }),
    ).toBeNull();
    const boton = screen.getByRole('button', { name: 'Subir archivos' });
    expect(boton).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Quitar rechazados' }),
    ).toBeNull();
  });

  it('con una mezcla: filas con motivo, resumen y botón cuentan solo los aceptados', async () => {
    montar();
    await usuario().upload(screen.getByLabelText('Elegir archivos'), MEZCLA());
    const lista = screen.getByRole('region', { name: 'Archivos elegidos' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(4);
    expect(filas[2]).toHaveTextContent('Solo se aceptan archivos .xml');
    expect(filas[3]).toHaveTextContent('El archivo pasa de 2 MB');
    expect(
      screen.getByText('2 de 4 listos. Los rechazados no se suben.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Subir 2 archivos' }),
    ).toBeEnabled();
  });

  it('un archivo válido: «1 archivo listo.» y «Subir 1 archivo» en singular (M14)', async () => {
    montar();
    await usuario().upload(screen.getByLabelText('Elegir archivos'), [
      archivo('a.xml'),
    ]);
    expect(screen.getByText('1 archivo listo.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Subir 1 archivo' }),
    ).toBeEnabled();
  });

  it('«Quitar rechazados» deja los 3 aceptados y el botón dice «Subir 3 archivos» (5.6)', async () => {
    const { alSeleccionar } = montar();
    const ok = ['a.xml', 'b.xml', 'c.xml'].map((n) => archivo(n));
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      ...ok,
      archivo('x.pdf'),
      archivo('grande.xml', 2 * MB + 1),
    ]);
    expect(
      screen.getByText('3 de 5 listos. Los rechazados no se suben.'),
    ).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Quitar rechazados' }));
    expect(alSeleccionar).toHaveBeenLastCalledWith(ok);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getByRole('button', { name: 'Subir 3 archivos' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Quitar rechazados' }),
    ).toBeNull();
    expect(screen.getByText('3 archivos listos.')).toBeInTheDocument();
  });

  it('con todos rechazados el botón sigue apagado (5.7)', async () => {
    montar();
    await usuario().upload(screen.getByLabelText('Elegir archivos'), [
      archivo('x.pdf'),
    ]);
    expect(
      screen.getByRole('button', { name: 'Subir archivos' }),
    ).toBeDisabled();
    expect(
      screen.getByText('0 de 1 listos. Los rechazados no se suben.'),
    ).toBeInTheDocument();
  });

  it('subir entrega solo los aceptados; los rechazados nunca se envían', async () => {
    const { onSubir } = montar();
    const lote = MEZCLA();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), lote);
    await u.click(screen.getByRole('button', { name: 'Subir 2 archivos' }));
    expect(onSubir).toHaveBeenCalledTimes(1);
    expect(onSubir).toHaveBeenCalledWith([lote[0], lote[1]]);
  });

  it('una elección nueva REEMPLAZA la anterior (M16)', async () => {
    montar();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      archivo('a.xml'),
      archivo('b.xml'),
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      archivo('c.xml'),
    ]);
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveTextContent('c.xml');
  });

  it('soltar archivos pasa por la MISMA evaluación que el botón', () => {
    montar();
    const zona = screen
      .getByText('Arrastra tus XML aquí')
      .closest('[data-deshabilitada]') as HTMLElement;
    fireEvent.drop(zona, {
      dataTransfer: { files: [archivo('a.xml'), archivo('b.pdf')] },
    });
    const filas = screen.getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('Listo para subir');
    expect(filas[1]).toHaveTextContent('Solo se aceptan archivos .xml');
  });

  it('una carpeta soltada se rechaza por la extensión', () => {
    montar();
    const zona = screen
      .getByText('Arrastra tus XML aquí')
      .closest('[data-deshabilitada]') as HTMLElement;
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('facturas', 0)] } });
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Solo se aceptan archivos .xml',
    );
  });

  it('más de 500 archivos: aviso del lote una vez y el botón cuenta 500', async () => {
    montar();
    const lote = Array.from({ length: 501 }, (_, i) => archivo(`f${i}.xml`));
    await usuario().upload(screen.getByLabelText('Elegir archivos'), lote);
    expect(
      screen.getAllByText(
        'Son más de 500 archivos. Divide la carga en partes más pequeñas.',
      ),
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Subir 500 archivos' }),
    ).toBeEnabled();
  });

  it('el nombre de un archivo es texto plano', async () => {
    montar();
    await usuario().upload(screen.getByLabelText('Elegir archivos'), [
      archivo('<b>x</b>.xml'),
    ]);
    expect(screen.getByRole('listitem').querySelector('b')).toBeNull();
    expect(screen.getByText('<b>x</b>.xml')).toBeInTheDocument();
  });

  it('solo lectura: todo deshabilitado y soltar se ignora (4.2)', async () => {
    const { alSeleccionar } = montar({
      deshabilitada: true,
      inicial: [archivo('a.xml')],
    });
    expect(screen.getByLabelText('Elegir archivos')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Subir 1 archivo' }),
    ).toBeDisabled();
    const zona = screen
      .getByText('Arrastra tus XML aquí')
      .closest('[data-deshabilitada]') as HTMLElement;
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('b.xml')] } });
    expect(alSeleccionar).not.toHaveBeenCalled();
  });

  it('solo lectura: «Quitar rechazados» también queda deshabilitado, no oculto', () => {
    montar({
      deshabilitada: true,
      inicial: [archivo('a.xml'), archivo('b.pdf')],
    });
    expect(
      screen.getByRole('button', { name: 'Quitar rechazados' }),
    ).toBeDisabled();
  });

  it('subiendo: el botón dice «Subiendo…» y todo lo de la tarjeta se apaga (M13)', () => {
    montar({ subiendo: true, inicial: [archivo('a.xml'), archivo('b.pdf')] });
    const boton = screen.getByRole('button', { name: 'Subiendo…' });
    expect(boton).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivos')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Quitar rechazados' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('region', { name: 'Archivos elegidos' }),
    ).toHaveAttribute('data-apagada', 'true');
  });

  it('la región de estado es persistente, enfocable y anuncia «Subiendo tus archivos» solo al subir', () => {
    const { regionRef } = montar();
    const region = screen.getByRole('status');
    expect(region).toBe(regionRef.current);
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(region).toBeEmptyDOMElement();
  });

  it('subiendo, la región dice «Subiendo tus archivos»', () => {
    montar({ subiendo: true });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Subiendo tus archivos',
    );
  });
  it('el resultado que recibe va dentro de la región de estado de la tarjeta', () => {
    render(
      <TarjetaCfdi {...PROPS_BASE} resultado={<p>Resultado de prueba</p>} />,
    );
    expect(screen.getByRole('status')).toContainElement(
      screen.getByText('Resultado de prueba'),
    );
  });

  it('sin resultado la región de estado queda vacía', () => {
    render(<TarjetaCfdi {...PROPS_BASE} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('la alerta de subida va en la tarjeta, fuera de la región de estado', () => {
    render(
      <TarjetaCfdi
        {...PROPS_BASE}
        alerta={<p role="alert">Fallo de prueba</p>}
      />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Fallo de prueba');
    expect(screen.getByRole('status')).not.toContainElement(alerta);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
