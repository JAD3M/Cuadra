import { useState, type DragEvent, type ReactNode } from 'react';
import estilos from './ZonaSoltar.module.css';

export interface ZonaSoltarProps {
  /** `false` con rol de solo lectura o mientras se sube: no acepta archivos. */
  habilitada: boolean;
  /** Los archivos soltados, en orden; la evaluación local los filtra después. */
  onSoltar: (archivos: File[]) => void;
  children: ReactNode;
}

/**
 * Zona punteada donde se sueltan archivos. No filtra nada: `accept` solo es
 * una pista del selector y un arrastre lo salta, así que decide la misma
 * evaluación local que usa el botón. Una carpeta llega como un archivo sin
 * extensión y esa regla la rechaza.
 */
export function ZonaSoltar({
  habilitada,
  onSoltar,
  children,
}: ZonaSoltarProps) {
  const [arrastrando, setArrastrando] = useState(false);

  function alEntrar() {
    if (habilitada) setArrastrando(true);
  }

  function alSalir(evento: DragEvent<HTMLDivElement>) {
    const destino = evento.relatedTarget;
    // Pasar sobre un hijo también dispara `dragleave` en la zona.
    if (destino instanceof Node && evento.currentTarget.contains(destino)) {
      return;
    }
    setArrastrando(false);
  }

  function alSobrevolar(evento: DragEvent<HTMLDivElement>) {
    // Sin `preventDefault` el navegador no deja soltar: es lo que apaga la zona.
    if (habilitada) evento.preventDefault();
  }

  function alSoltar(evento: DragEvent<HTMLDivElement>) {
    // Siempre: si no, el navegador abriría el archivo soltado en la pestaña.
    evento.preventDefault();
    setArrastrando(false);
    if (!habilitada) return;
    onSoltar(Array.from(evento.dataTransfer.files));
  }

  return (
    <div
      className={estilos.zona}
      data-arrastrando={habilitada && arrastrando}
      data-deshabilitada={!habilitada}
      onDragEnter={alEntrar}
      onDragLeave={alSalir}
      onDragOver={alSobrevolar}
      onDrop={alSoltar}
    >
      {children}
    </div>
  );
}
