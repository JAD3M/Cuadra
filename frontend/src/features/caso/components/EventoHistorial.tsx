import {
  ACCION_CONFIRMAR,
  ACCION_CREAR,
  ACCION_RECHAZAR,
  ETIQUETAS_ACCION_BITACORA,
} from '@/shared/dominio';
import type { AccionBitacora } from '@/shared/dominio';
import {
  formatearDiaDeInstante,
  formatearInstante,
} from '@/features/caso/fecha';
import { DESCARTADO, HISTORIAL } from '@/features/caso/textos';
import estilos from './EventoHistorial.module.css';

export interface EventoHistorialProps {
  /** Acción tal como la envía el servidor; una desconocida se muestra igual. */
  accion: string;
  /** Quién actuó; `null` es el sistema. */
  usuario: { nombre: string } | null;
  /** Instante ISO del evento. */
  createdAt: string;
  /** Etiqueta del CFDI propuesto, para el evento `crear`. */
  etiquetaCfdi: string | null;
  /** Entidad del evento; `cfdi` + `actualizar` es la cancelación de una factura. */
  entidad?: string;
  /** Etiqueta de la factura cancelada; `null` si no se conoce. */
  etiquetaFactura?: string | null;
}

function esCancelacionDeFactura(entidad: string | undefined, accion: string) {
  return entidad === 'cfdi' && accion === 'actualizar';
}

function esAccionConocida(accion: string): accion is AccionBitacora {
  return Object.hasOwn(ETIQUETAS_ACCION_BITACORA, accion);
}

function tituloDe(accion: string, etiquetaCfdi: string | null): string {
  if (!esAccionConocida(accion)) return accion;
  if (accion !== 'crear') return ETIQUETAS_ACCION_BITACORA[accion];
  return etiquetaCfdi === null
    ? HISTORIAL.propuestaSinCfdi
    : `${ETIQUETAS_ACCION_BITACORA.crear} ${etiquetaCfdi}`;
}

function tonoDe(accion: string, cancelacion: boolean): string {
  if (cancelacion) return estilos.revision ?? '';
  if (accion === ACCION_CREAR) return estilos.propuesta ?? '';
  if (accion === ACCION_CONFIRMAR) return estilos.confirmada ?? '';
  if (accion === ACCION_RECHAZAR) return estilos.rechazada ?? '';
  return estilos.neutro ?? '';
}

/**
 * Un evento del historial: etiqueta de la acción, quién la hizo y cuándo. Solo
 * recibe esos campos: el detalle (`datos`), el correo y la IP no llegan aquí.
 */
export function EventoHistorial({
  accion,
  usuario,
  createdAt,
  etiquetaCfdi,
  entidad,
  etiquetaFactura = null,
}: EventoHistorialProps) {
  const cancelacion = esCancelacionDeFactura(entidad, accion);
  return (
    <li className={estilos.evento}>
      <span
        className={`${estilos.punto} ${tonoDe(accion, cancelacion)}`}
        aria-hidden="true"
      />
      <div className={estilos.cuerpo}>
        <strong className={estilos.titulo}>
          {cancelacion
            ? HISTORIAL.facturaCancelada(etiquetaFactura)
            : tituloDe(accion, etiquetaCfdi)}
        </strong>
        <span className={estilos.detalle}>
          {cancelacion
            ? HISTORIAL.facturaCanceladaDetalle
            : (usuario?.nombre ?? HISTORIAL.sistema)}
        </span>
        <span className={estilos.cuando}>{formatearInstante(createdAt)}</span>
      </div>
    </li>
  );
}

/**
 * «Esperando decisión»: fila derivada del estado `sugerencia` del servidor,
 * para decir que nadie ha resuelto el caso. No es un evento del historial.
 */
export function EventoPendiente() {
  return (
    <li className={estilos.evento} data-testid="evento-pendiente">
      <span
        className={`${estilos.punto} ${estilos.neutro}`}
        aria-hidden="true"
      />
      <div className={estilos.cuerpo}>
        <strong className={estilos.titulo}>{HISTORIAL.pendiente.titulo}</strong>
        <span className={estilos.detalle}>{HISTORIAL.pendiente.detalle}</span>
        <span className={estilos.cuando}>{HISTORIAL.pendiente.cuando}</span>
      </div>
    </li>
  );
}

export interface EventoDescarteProps {
  /** Quién descartó; `null` si el servidor no lo devolvió. */
  por: string | null;
  motivo: string;
  /** Instante ISO del descarte; `null` si el servidor no lo devolvió. */
  fecha: string | null;
}

/**
 * «Descartado»: fila derivada del descarte vigente del caso, con quién y el
 * motivo que devolvió el servidor. No es un evento de conciliación: el
 * movimiento descartado no tiene propuestas ni historial propio.
 */
export function EventoDescarte({ por, motivo, fecha }: EventoDescarteProps) {
  return (
    <li className={estilos.evento} data-testid="evento-descarte">
      <span
        className={`${estilos.punto} ${estilos.neutro}`}
        aria-hidden="true"
      />
      <div className={estilos.cuerpo}>
        <strong className={estilos.titulo}>{DESCARTADO.evento}</strong>
        <span className={estilos.detalle}>
          {por === null ? motivo : `${por}${HISTORIAL.separador}${motivo}`}
        </span>
        <span className={estilos.cuando}>
          {fecha === null ? DESCARTADO.sinDato : formatearDiaDeInstante(fecha)}
        </span>
      </div>
    </li>
  );
}
