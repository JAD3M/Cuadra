import {
  ESTADO_DE_ARCHIVO,
  LISTA_RESULTADO_ARCHIVOS,
  RESUMEN_CFDI,
} from '@/features/cargas/textos';
import { RESULTADO_ERROR, type ResultadoArchivo } from '@/shared/dominio';
import estilos from './resultado.module.css';

export interface ArchivoResultado {
  archivo: string;
  resultado: ResultadoArchivo;
  /** Solo viene con el resultado de error. */
  motivo?: string;
}

export interface ResultadoCfdiProps {
  /** Archivos nuevos (`registrosOk`). */
  nuevos: number;
  /** Archivos que ya existían (`registrosExistentes`). */
  existentes: number;
  conError: number;
  archivos: readonly ArchivoResultado[];
}

/** Marca de cada resultado; el estado también va en texto, nunca solo en color. */
const MARCA: Readonly<Record<ResultadoArchivo, string>> = {
  nuevo: '✓',
  ya_existia: '○',
  error: '✕',
};

/** Tono de cada resultado; el CSS lo pinta con su color de texto. */
const TONO: Readonly<Record<ResultadoArchivo, 'ok' | 'neutro' | 'peligro'>> = {
  nuevo: 'ok',
  ya_existia: 'neutro',
  error: 'peligro',
};

/**
 * Resultado de un lote de CFDI ya terminado: el resumen y una entrada por
 * archivo. El nombre y el motivo vienen del servidor: van como nodos de texto
 * de React, nunca como HTML.
 */
export function ResultadoCfdi({
  nuevos,
  existentes,
  conError,
  archivos,
}: ResultadoCfdiProps) {
  return (
    <div className={estilos.caja}>
      <p className={estilos.resumen}>
        <span className={estilos.cifra}>{nuevos}</span> {RESUMEN_CFDI.nuevos}{' '}
        <span className={estilos.cifra}>{existentes}</span>{' '}
        {RESUMEN_CFDI.existentes}{' '}
        <span className={estilos.cifra}>{conError}</span>{' '}
        {RESUMEN_CFDI.conError}
      </p>
      {archivos.length === 0 ? null : (
        <div
          role="region"
          aria-label={LISTA_RESULTADO_ARCHIVOS}
          // Enfocable: sin esto un teclado no podría desplazar una lista larga.
          tabIndex={0}
          // Dentro de la región de estado, cientos de archivos no se leen
          // enteros cada vez que el panel cambia; se recorren con el lector.
          aria-live="off"
          className={estilos.region}
        >
          <ul className={estilos.lista}>
            {archivos.map((r, i) => (
              <li
                // Los nombres se pueden repetir en un lote: el orden es la clave.
                key={`${i}-${r.archivo}`}
                className={estilos.archivo}
                data-tono={TONO[r.resultado]}
              >
                <span className={estilos.marca} aria-hidden="true">
                  {MARCA[r.resultado]}
                </span>
                <span className={estilos.texto}>
                  <span className={estilos.nombre}>{r.archivo}</span>
                  {r.resultado === RESULTADO_ERROR && r.motivo ? (
                    <span className={estilos.motivo} data-motivo>
                      {r.motivo}
                    </span>
                  ) : null}
                </span>
                <span className={estilos.estado}>
                  {ESTADO_DE_ARCHIVO[r.resultado]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
