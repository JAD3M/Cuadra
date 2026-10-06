import {
  LISTA_FILAS_CON_ERROR,
  RESUMEN_ESTADO_CUENTA,
  textoDeFila,
} from '@/features/cargas/textos';
import estilos from './resultado.module.css';

export interface FilaConError {
  /** La línea física del archivo (el encabezado es la 1). */
  fila: number;
  motivo: string;
}

export interface ResultadoEstadoCuentaProps {
  /** Registros cargados (`registrosOk`). */
  registros: number;
  conError: number;
  filas: readonly FilaConError[];
}

/**
 * Resultado de un estado de cuenta ya terminado: el resumen y una línea por
 * cada fila que no entró. Las filas buenas no se listan y la cuenta nunca se
 * muestra. El motivo es texto del servidor: va como nodo de texto.
 */
export function ResultadoEstadoCuenta({
  registros,
  conError,
  filas,
}: ResultadoEstadoCuentaProps) {
  return (
    <div className={estilos.caja}>
      <p className={estilos.resumen}>
        <span className={estilos.cifra}>{registros}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.registros}{' '}
        <span className={estilos.cifra}>{conError}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.conError}
      </p>
      {filas.length === 0 ? null : (
        <div
          role="region"
          aria-label={LISTA_FILAS_CON_ERROR}
          // Enfocable: una lista larga se desplaza con el teclado.
          tabIndex={0}
          aria-live="off"
          className={estilos.region}
        >
          <ul className={estilos.lista}>
            {filas.map((f, i) => (
              <li key={`${i}-${f.fila}`} className={estilos.fila}>
                <span className={estilos.filaMarca} aria-hidden="true">
                  ✕
                </span>
                <span className={estilos.filaTexto}>
                  {textoDeFila(f.fila, f.motivo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
