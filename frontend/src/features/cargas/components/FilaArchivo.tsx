import { ARCHIVO_LISTO } from '@/features/cargas/textos';
import { formatearPeso } from '@/features/cargas/peso';
import estilos from './FilaArchivo.module.css';

export interface FilaArchivoProps {
  archivo: { name: string; size: number };
  /** Texto del rechazo; `null` si el archivo va. */
  motivo: string | null;
}

/**
 * Una fila de la selección: marca, nombre, detalle y peso. La marca es
 * decorativa; el estado lo dicen el detalle («Listo para subir» o el motivo) y
 * el borde. El nombre es texto plano: lo que parezca HTML se muestra tal cual.
 */
export function FilaArchivo({ archivo, motivo }: FilaArchivoProps) {
  const rechazado = motivo !== null;
  return (
    <li className={estilos.fila} data-rechazado={rechazado}>
      <span className={estilos.marca} aria-hidden="true">
        {rechazado ? '✕' : '✓'}
      </span>
      <span className={estilos.texto}>
        <span className={estilos.nombre}>{archivo.name}</span>
        <span className={estilos.detalle}>{motivo ?? ARCHIVO_LISTO}</span>
      </span>
      <span className={estilos.peso}>{formatearPeso(archivo.size)}</span>
    </li>
  );
}
