import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilaArchivo } from './FilaArchivo';

function montar(
  archivo: { name: string; size: number },
  motivo: string | null,
) {
  render(
    <ul>
      <FilaArchivo archivo={archivo} motivo={motivo} />
    </ul>,
  );
  return screen.getByRole('listitem');
}

describe('FilaArchivo', () => {
  it('un archivo válido dice «Listo para subir» con su peso', () => {
    const fila = montar({ name: 'factura-A-1044.xml', size: 14 * 1024 }, null);
    expect(fila).toHaveTextContent('factura-A-1044.xml');
    expect(fila).toHaveTextContent('Listo para subir');
    expect(fila).toHaveTextContent('14 KB');
    expect(fila).toHaveAttribute('data-rechazado', 'false');
  });

  it('un rechazado muestra su motivo en vez de «Listo para subir»', () => {
    const fila = montar(
      { name: 'respaldo-facturas.xml', size: 3_565_158 },
      'El archivo pasa de 2 MB',
    );
    expect(fila).toHaveTextContent('El archivo pasa de 2 MB');
    expect(fila).not.toHaveTextContent('Listo para subir');
    expect(fila).toHaveAttribute('data-rechazado', 'true');
    expect(fila).toHaveTextContent('3.4 MB');
  });

  it('el icono es decorativo: el estado lo dice el texto', () => {
    const fila = montar(
      { name: 'a.xml', size: 1 },
      'Solo se aceptan archivos .xml',
    );
    const icono = fila.querySelector('[aria-hidden="true"]');
    expect(icono).not.toBeNull();
    expect(icono?.textContent).toBe('✕');
  });

  it('el nombre es texto plano: el HTML no se interpreta', () => {
    const fila = montar({ name: '<b>x</b>.xml', size: 1 }, null);
    expect(fila.querySelector('b')).toBeNull();
    expect(fila).toHaveTextContent('<b>x</b>.xml');
  });

  it('el peso no se parte en dos líneas: vive en un solo elemento', () => {
    const fila = montar({ name: 'a.xml', size: 2 * 1024 * 1024 }, null);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    expect(fila).toContainElement(screen.getByText('2.0 MB'));
  });
});
