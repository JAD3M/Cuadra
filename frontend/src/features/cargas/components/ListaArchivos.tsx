import type {
  ArchivoEvaluado,
  MotivoRechazo,
} from '@/features/cargas/seleccion';
import { FilaArchivo } from './FilaArchivo';
import estilos from './ListaArchivos.module.css';

export interface ListaArchivosProps {
  archivos: readonly ArchivoEvaluado<{ name: string; size: number }>[];
  /** Texto de cada motivo de rechazo, según la tarjeta. */
  motivos: Readonly<Record<MotivoRechazo, string>>;
  /** Nombre accesible de la región. */
  rotulo: string;
  /** Mientras se sube: se marca, pero los archivos siguen a la vista. */
  apagada?: boolean;
}

/**
 * Los topes de cantidad y de total son del LOTE, no de un archivo: se avisan
 * una sola vez arriba (como en el mockup) en vez de repetirse en cada archivo
 * que sobra, que pueden ser cientos.
 */
const MOTIVOS_DEL_LOTE: readonly MotivoRechazo[] = ['cantidad', 'total'];

/**
 * Lista de la selección. Es una región con nombre y enfocable con el teclado
 * porque puede tener hasta 500 filas y se desplaza, nunca recorta.
 */
export function ListaArchivos({
  archivos,
  motivos,
  rotulo,
  apagada = false,
}: ListaArchivosProps) {
  if (archivos.length === 0) return null;
  const avisosDelLote = MOTIVOS_DEL_LOTE.filter((motivo) =>
    archivos.some((e) => e.motivo === motivo),
  );
  const visibles = archivos.filter(
    (e) => e.motivo === null || !MOTIVOS_DEL_LOTE.includes(e.motivo),
  );
  return (
    <div
      role="region"
      aria-label={rotulo}
      // Enfocable: sin esto un teclado no podría desplazar una lista larga.
      tabIndex={0}
      className={estilos.region}
      data-apagada={apagada}
    >
      <ul className={estilos.lista}>
        {avisosDelLote.map((motivo) => (
          <li key={motivo} className={estilos.lote}>
            <span className={estilos.marca} aria-hidden="true">
              ✕
            </span>
            <span className={estilos.aviso}>{motivos[motivo]}</span>
          </li>
        ))}
        {visibles.map(({ archivo, motivo }, i) => (
          <FilaArchivo
            // Los nombres se pueden repetir en una selección: el orden es la clave.
            key={`${i}-${archivo.name}`}
            archivo={archivo}
            motivo={motivo === null ? null : motivos[motivo]}
          />
        ))}
      </ul>
    </div>
  );
}
