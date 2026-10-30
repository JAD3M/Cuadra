import {
  LEYENDA_ESTADO_CUENTA,
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
  /** Registros que entraron (`registrosOk`), dudosos incluidos. */
  registros: number;
  /** Movimientos que ya estaban y se omitieron (`registrosExistentes`). */
  existentes: number;
  /** Entraron como pendiente_revision: ya cuentan dentro de `registros`. */
  dudosos: number;
  conError: number;
  filas: readonly FilaConError[];
}

/**
 * Resultado de un estado de cuenta ya terminado: el resumen (nuevos, ya
 * existían, dudosos y con error), la leyenda ámbar si hubo dudosos o repetidos
 * y una línea por cada fila que no entró. Las filas buenas no se listan y la cuenta nunca se
 * muestra. El motivo es texto del servidor: va como nodo de texto.
 */
export function ResultadoEstadoCuenta({
  registros,
  existentes,
  dudosos,
  conError,
  filas,
}: ResultadoEstadoCuentaProps) {
  // Los dudosos ya están dentro de los registros que entraron.
  const nuevos = Math.max(registros - dudosos, 0);
  return (
    <div className={estilos.caja}>
      <p className={estilos.resumen}>
        <span className={estilos.cifra}>{nuevos}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.nuevos(nuevos)}{' '}
        <span className={estilos.cifra}>{existentes}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.existentes(existentes)}{' '}
        <span className={estilos.cifra}>{dudosos}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.dudosos(dudosos)}{' '}
        <span className={estilos.cifra}>{conError}</span>{' '}
        {RESUMEN_ESTADO_CUENTA.conError}
      </p>
      {dudosos > 0 || existentes > 0 ? (
        <p className={estilos.leyendaRepetidos}>
          {dudosos > 0 ? (
            <span>{LEYENDA_ESTADO_CUENTA.dudosos(dudosos)}</span>
          ) : null}
          {dudosos > 0 && existentes > 0 ? ' ' : null}
          {existentes > 0 ? (
            <span>{LEYENDA_ESTADO_CUENTA.existentes(existentes)}</span>
          ) : null}
        </p>
      ) : null}
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
