import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RECHAZO_CFDI } from '@/features/cargas/textos';
import { REGLAS_CFDI, evaluarSeleccion } from '@/features/cargas/seleccion';
import { ListaArchivos } from './ListaArchivos';

const MB = 1024 * 1024;
const archivo = (name: string, size = 1024) => ({ name, size });

function montar(
  archivos: readonly { name: string; size: number }[],
  apagada = false,
) {
  render(
    <ListaArchivos
      archivos={evaluarSeleccion(archivos, REGLAS_CFDI)}
      motivos={RECHAZO_CFDI}
      rotulo="Archivos elegidos"
      apagada={apagada}
    />,
  );
}

describe('ListaArchivos', () => {
  it('sin archivos no pinta nada', () => {
    const { container } = render(
      <ListaArchivos
        archivos={[]}
        motivos={RECHAZO_CFDI}
        rotulo="Archivos elegidos"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('una fila por archivo, con los rechazados y su motivo', () => {
    montar([
      archivo('a.xml', 14 * 1024),
      archivo('conciliar.py', 3 * 1024),
      archivo('respaldo.xml', 2 * MB + 1),
    ]);
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('Listo para subir');
    expect(filas[1]).toHaveTextContent('Solo se aceptan archivos .xml');
    expect(filas[2]).toHaveTextContent('El archivo pasa de 2 MB');
  });

  it('la región es nombrada, enfocable con el teclado y se desplaza sin recortar', () => {
    montar([archivo('a.xml')]);
    const region = screen.getByRole('region', { name: 'Archivos elegidos' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('list')).toBeInTheDocument();
  });

  it('más de 500 archivos: una sola fila de límite con el texto de M4', () => {
    const lote = Array.from({ length: 503 }, (_, i) => archivo(`f${i}.xml`));
    montar(lote);
    const mensajes = screen.getAllByText(RECHAZO_CFDI.cantidad);
    expect(mensajes).toHaveLength(1);
    // 500 válidos y la fila de límite; los tres sobrantes no se listan uno a uno.
    expect(screen.getAllByRole('listitem')).toHaveLength(501);
  });

  it('más de 50 MB en total: una fila de límite con el texto de M4', () => {
    const lote = Array.from({ length: 27 }, (_, i) =>
      archivo(`f${i}.xml`, 2 * MB),
    );
    montar(lote);
    expect(screen.getAllByText(RECHAZO_CFDI.total)).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(26);
  });

  it('los textos de límite son los aprobados, literales', () => {
    expect(RECHAZO_CFDI.cantidad).toBe(
      'Son más de 500 archivos. Divide la carga en partes más pequeñas.',
    );
    expect(RECHAZO_CFDI.total).toBe(
      'La selección pasa de 50 MB. Divide la carga en partes más pequeñas.',
    );
  });

  it('apagada (subiendo) lo marca sin quitar los archivos', () => {
    montar([archivo('a.xml')], true);
    expect(
      screen.getByRole('region', { name: 'Archivos elegidos' }),
    ).toHaveAttribute('data-apagada', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
