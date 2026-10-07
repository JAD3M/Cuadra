import { useId, type ReactNode } from 'react';
import { formatearDecimalExacto } from '@/shared/dinero';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  CARGANDO_TOLERANCIA,
  ERROR_CONEXION,
  ERROR_LECTURA_OTRO,
  ERROR_SIN_PERMISO,
  EXPLICACION_VALOR,
  MONEDA,
  REINTENTAR,
  VALOR_ACTUAL,
} from '@/features/tolerancia/textos';
import estilos from './TarjetaValor.module.css';

/** Por qué no se pudo leer el valor; nunca lleva texto del servidor. */
export type ClaseErrorValor = 'conexion' | 'sin_permiso' | 'otro';

/** Qué muestra la tarjeta. `valor` es el decimal en cadena que dio el servidor. */
export type EstadoValor =
  | { tipo: 'cargando' }
  | { tipo: 'error'; clase: ClaseErrorValor }
  | { tipo: 'listo'; valor: string };

export interface TarjetaValorProps {
  estado: EstadoValor;
  /** Ausente = sin reintento. Con `sin_permiso` nunca se ofrece: no ayudaría. */
  onReintentar?: () => void;
  /** Formulario o aviso de solo administrador; solo se pinta con el valor listo. */
  children?: ReactNode;
}

const TEXTO_ERROR = {
  conexion: ERROR_CONEXION,
  sin_permiso: ERROR_SIN_PERMISO,
  otro: ERROR_LECTURA_OTRO,
} as const;

/**
 * Tarjeta «Valor actual». El monto va en un solo elemento que no se parte y se
 * formatea sobre la cadena decimal sin redondear nunca (`0.0050` -> `$0.005`),
 * nunca con el formateador de dos decimales. Un valor que el formateador no
 * reconoce se muestra tal cual: el contrato ya lo valida, esto es solo una red.
 */
export function TarjetaValor({
  estado,
  onReintentar,
  children,
}: TarjetaValorProps) {
  const idTitulo = useId();
  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.titulo}>
        {VALOR_ACTUAL}
      </h2>
      {estado.tipo === 'cargando' ? (
        <div role="status" aria-busy="true" className={estilos.esqueleto}>
          <span className="solo-lectores">{CARGANDO_TOLERANCIA}</span>
          <div className={estilos.barraMonto} aria-hidden="true" />
          <div className={estilos.barraLarga} aria-hidden="true" />
          <div className={estilos.barraCorta} aria-hidden="true" />
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
      {estado.tipo === 'listo' ? (
        <>
          <div className={estilos.valor}>
            <span className={estilos.monto}>
              {`$${formatearDecimalExacto(estado.valor) ?? estado.valor}`}
            </span>
            <span className={estilos.moneda}>{MONEDA}</span>
          </div>
          <p className={estilos.explicacion}>{EXPLICACION_VALOR}</p>
          {children}
        </>
      ) : null}
    </section>
  );
}
