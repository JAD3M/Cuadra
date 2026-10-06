import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZonaSoltar } from './ZonaSoltar';

const archivo = (nombre: string) => new File(['x'], nombre);

function montar(habilitada = true) {
  const onSoltar = vi.fn();
  const { container } = render(
    <ZonaSoltar habilitada={habilitada} onSoltar={onSoltar}>
      <span>contenido de la zona</span>
    </ZonaSoltar>,
  );
  return { onSoltar, zona: container.firstElementChild as HTMLElement };
}

/** `dragover` que informa si alguien llamó a `preventDefault`. */
function sobrevolar(zona: HTMLElement): boolean {
  const evento = createEvent.dragOver(zona);
  fireEvent(zona, evento);
  return evento.defaultPrevented;
}

describe('ZonaSoltar', () => {
  it('muestra a sus hijos', () => {
    montar();
    expect(screen.getByText('contenido de la zona')).toBeInTheDocument();
  });

  it('dragover habilitada: permite soltar (preventDefault)', () => {
    const { zona } = montar(true);
    expect(sobrevolar(zona)).toBe(true);
  });

  it('dragover deshabilitada: no lo permite', () => {
    const { zona } = montar(false);
    expect(sobrevolar(zona)).toBe(false);
  });

  it('drop entrega los archivos soltados, en orden, como arreglo', () => {
    const { onSoltar, zona } = montar();
    const a = archivo('a.xml');
    const b = archivo('b.xml');
    fireEvent.drop(zona, { dataTransfer: { files: [a, b] } });
    expect(onSoltar).toHaveBeenCalledTimes(1);
    expect(onSoltar).toHaveBeenCalledWith([a, b]);
  });

  it('drop no filtra por tipo: accept no se confía, decide la evaluación', () => {
    const { onSoltar, zona } = montar();
    const pdf = archivo('factura.pdf');
    fireEvent.drop(zona, { dataTransfer: { files: [pdf] } });
    expect(onSoltar).toHaveBeenCalledWith([pdf]);
  });

  it('una carpeta soltada llega como un archivo sin extensión', () => {
    const { onSoltar, zona } = montar();
    const carpeta = archivo('facturas');
    fireEvent.drop(zona, { dataTransfer: { files: [carpeta] } });
    expect(onSoltar).toHaveBeenCalledWith([carpeta]);
  });

  it('deshabilitada o subiendo, el drop se ignora', () => {
    const { onSoltar, zona } = montar(false);
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('a.xml')] } });
    expect(onSoltar).not.toHaveBeenCalled();
  });

  it('el drop siempre evita que el navegador abra el archivo', () => {
    const { zona } = montar(false);
    const evento = createEvent.drop(zona, {
      dataTransfer: { files: [archivo('a.xml')] },
    });
    fireEvent(zona, evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('marca data-arrastrando al entrar con un arrastre y lo quita al salir o soltar', () => {
    const { zona } = montar();
    expect(zona).toHaveAttribute('data-arrastrando', 'false');
    fireEvent.dragEnter(zona);
    expect(zona).toHaveAttribute('data-arrastrando', 'true');
    fireEvent.dragLeave(zona);
    expect(zona).toHaveAttribute('data-arrastrando', 'false');
    fireEvent.dragEnter(zona);
    fireEvent.drop(zona, { dataTransfer: { files: [] } });
    expect(zona).toHaveAttribute('data-arrastrando', 'false');
  });

  it('deshabilitada no se marca como arrastrando', () => {
    const { zona } = montar(false);
    fireEvent.dragEnter(zona);
    expect(zona).toHaveAttribute('data-arrastrando', 'false');
    expect(zona).toHaveAttribute('data-deshabilitada', 'true');
  });

  it('salir hacia un hijo de la zona no apaga el resalte', () => {
    const { zona } = montar();
    fireEvent.dragEnter(zona);
    const hijo = screen.getByText('contenido de la zona');
    // jsdom no tiene DragEvent: `relatedTarget` se fija en el evento a mano.
    const evento = createEvent.dragLeave(zona);
    Object.defineProperty(evento, 'relatedTarget', { value: hijo });
    fireEvent(zona, evento);
    expect(zona).toHaveAttribute('data-arrastrando', 'true');
  });
});
