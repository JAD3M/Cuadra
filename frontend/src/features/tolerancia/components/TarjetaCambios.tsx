import { useId } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  CAMBIOS_RECIENTES,
  CARGANDO_CAMBIOS,
  ERROR_CAMBIOS,
  ERROR_LECTURA_OTRO,
  ERROR_SIN_PERMISO,
  REINTENTAR,
  SIN_CAMBIOS,
  ULTIMOS_CAMBIOS,
} from '@/features/tolerancia/textos';
import estilos from './TarjetaCambios.module.css';

/** Por qué no se pudieron leer los cambios; nunca lleva texto del servidor. */
export type ClaseErrorCambios = 'conexion' | 'sin_permiso' | 'otro';

/** Una fila ya formateada: montos con `$`, sin redondear, y fecha lista. */
export interface FilaCambio {
  id: string;
  antes: string;
  despues: string;
  quien: string;
  fecha: string;
  /** Solo el cambio más nuevo resalta su valor nuevo. */
  reciente: boolean;
}

export type EstadoCambios =
  | { tipo: 'cargando' }
  | { tipo: 'error'; clase: ClaseErrorCambios }
  | { tipo: 'vacio' }
  | { tipo: 'lista'; filas: readonly FilaCambio[] };

export interface TarjetaCambiosProps {
  estado: EstadoCambios;
  /** Ausente = sin reintento. Con `sin_permiso` nunca se ofrece: no ayudaría. */
  onReintentar?: () => void;
}

const TEXTO_ERROR = {
  conexion: ERROR_CAMBIOS,
  sin_permiso: ERROR_SIN_PERMISO,
  otro: ERROR_LECTURA_OTRO,
} as const;

/**
 * Tarjeta «Cambios recientes». Es presentacional: recibe las filas ya
 * derivadas. No lleva enlace a la bitácora (vuelve con CU-26). Los montos y la
 * fecha son elementos que no se parten; el nombre de quien cambió sí se parte.
 */
export function TarjetaCambios({ estado, onReintentar }: TarjetaCambiosProps) {
  const idTitulo = useId();
  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.titulo}>
        {CAMBIOS_RECIENTES}
      </h2>
      {estado.tipo === 'cargando' ? (
        <div role="status" aria-busy="true" className={estilos.esqueleto}>
          <span className="solo-lectores">{CARGANDO_CAMBIOS}</span>
          <div className={estilos.barra} aria-hidden="true" />
          <div className={estilos.barra} aria-hidden="true" />
          <div className={estilos.barra} aria-hidden="true" />
        </div>
      ) : null}
      {estado.tipo === 'error' ? (
        <AlertaError
          {...TEXTO_ERROR[estado.clase]}
          accion={
            estado.clase !== 'sin_permiso' && onReintentar !== undefined ? (
              <Button variante="secundario" onClick={onReintentar}>
                {REINTENTAR}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {estado.tipo === 'vacio' ? (
        <div className={estilos.vacio}>
          <strong className={estilos.vacioTitulo}>{SIN_CAMBIOS.titulo}</strong>
          <span className={estilos.vacioDetalle}>{SIN_CAMBIOS.detalle}</span>
        </div>
      ) : null}
      {estado.tipo === 'lista' ? (
        <ol className={estilos.lista} aria-label={ULTIMOS_CAMBIOS}>
          {estado.filas.map((f) => (
            <li key={f.id} className={estilos.fila}>
              <span className={estilos.importes}>
                <span className={estilos.antes}>{f.antes}</span>
                {' → '}
                <span
                  className={
                    f.reciente ? estilos.despuesReciente : estilos.despues
                  }
                >
                  {f.despues}
                </span>
              </span>
              <span className={estilos.detalle}>
                <span className={estilos.autor}>{f.quien}</span>
                {' · '}
                <span className={estilos.fecha}>{f.fecha}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
