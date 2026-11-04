import { Fragment } from 'react';
import { Link } from 'react-router';
import { formatearInstante } from '@/features/caso/fecha';
import {
  ETIQUETAS_ESTADO_CARGA,
  ETIQUETAS_TIPO_CARGA,
  type EstadoCarga,
  type TipoCarga,
} from '@/shared/dominio';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { Td } from '@/shared/ui/Tabla';
import { notaMonedaHistorial } from '@/features/cargas/moneda';
import { rutaVistaPrevia } from '@/features/cargas/rutas';
import {
  COLUMNAS_CARGAS,
  MOTIVO_RECHAZO,
  REVISAR_VISTA_PREVIA,
  SIN_DATO,
} from '@/features/cargas/textos';
import { TONO_ESTADO_CARGA } from '@/features/cargas/tonos';
import { BarraAvance } from './BarraAvance';
import { DetalleRechazo } from './DetalleRechazo';
import estilos from './FilaCarga.module.css';

/** Lo que la tabla necesita de una carga; la del contrato la cumple. */
export interface FilaHistorial {
  id: string;
  tipo: TipoCarga;
  nombreArchivo: string;
  estado: EstadoCarga;
  registrosOk: number;
  registrosError: number;
  subidoPor: string | null;
  createdAt: string;
  /**
   * Cuántos archivos de la carga quedaron marcados «moneda no soportada».
   * El listado lo trae (0 = sin nota); ausente también es sin nota.
   */
  monedaNoSoportada?: number;
}

export interface FilaCargaProps {
  carga: FilaHistorial;
  /** Solo una carga rechazada se abre (historia 3.7); en las demás se ignora. */
  abierta?: boolean;
  /** Abrir o cerrar la fila; la tabla deja una sola abierta a la vez. */
  onAlternar?: () => void;
}

/** Cuántas columnas tiene la tabla: la fila de detalle las ocupa todas. */
const COLUMNAS = Object.keys(COLUMNAS_CARGAS).length;

/**
 * Si la fila muestra los contadores (M12, ajustada al mockup v23). Activa
 * (pendiente o procesando), el servidor aún no los escribe; fallida, la carga
 * no se procesó y un «0» sugeriría que se revisó. En los tres casos va «—».
 */
const MUESTRA_CONTADORES: Readonly<Record<EstadoCarga, boolean>> = {
  pendiente: false,
  procesando: false,
  procesada: true,
  con_errores: true,
  fallida: false,
  pendiente_vista_previa: false,
  rechazada: false,
};

/**
 * Fila del historial. No decide nada: solo la de una carga rechazada se abre,
 * con un botón (el camino del teclado) o con un clic en la fila, y muestra el
 * motivo del rechazo. Los contadores salen tal como
 * llegaron solo en una carga procesada o con errores; en las demás se muestra
 * «—» (ver `MUESTRA_CONTADORES`). El nombre del archivo es texto plano; el CSS
 * lo trunca a la vista, pero el texto completo sigue en el DOM.
 */
export function FilaCarga({
  carga,
  abierta = false,
  onAlternar,
}: FilaCargaProps) {
  const expandible = carga.estado === 'rechazada' && onAlternar !== undefined;
  const desplegada = expandible && abierta;
  const sinContadores = !MUESTRA_CONTADORES[carga.estado];
  const nota = sinContadores
    ? null
    : notaMonedaHistorial(carga.monedaNoSoportada ?? 0);
  const resaltaError = !sinContadores && carga.registrosError > 0;
  return (
    <Fragment>
      <tr
        className={expandible ? estilos.expandible : undefined}
        onClick={expandible ? onAlternar : undefined}
      >
        <Td>{ETIQUETAS_TIPO_CARGA[carga.tipo]}</Td>
        <Td className={estilos.archivo}>
          <span className={estilos.nombre} title={carga.nombreArchivo}>
            {carga.nombreArchivo}
          </span>
        </Td>
        <Td>
          <div className={estilos.estado}>
            <EstadoChip tono={TONO_ESTADO_CARGA[carga.estado]}>
              {ETIQUETAS_ESTADO_CARGA[carga.estado]}
            </EstadoChip>
            {expandible ? (
              <button
                type="button"
                className={estilos.alternar}
                aria-expanded={desplegada}
                aria-label={MOTIVO_RECHAZO.verMotivo(carga.nombreArchivo)}
                onClick={(evento) => {
                  // La fila también alterna: sin esto un clic dispararía dos veces.
                  evento.stopPropagation();
                  onAlternar();
                }}
              >
                <svg
                  className={estilos.flecha}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ) : null}
            {carga.estado === 'pendiente_vista_previa' ? (
              <Link className={estilos.revisar} to={rutaVistaPrevia(carga.id)}>
                {REVISAR_VISTA_PREVIA}
              </Link>
            ) : null}
          </div>
        </Td>
        <Td>
          <BarraAvance estado={carga.estado} />
        </Td>
        <Td numerica>
          <span
            className={`${estilos.contador} ${sinContadores ? estilos.atenuado : ''}`}
          >
            {sinContadores ? SIN_DATO : carga.registrosOk}
          </span>
          {nota === null ? null : <span className={estilos.nota}>{nota}</span>}
        </Td>
        <Td numerica>
          <span
            className={`${estilos.contador} ${
              resaltaError ? estilos.conError : estilos.atenuado
            }`}
          >
            {sinContadores ? SIN_DATO : carga.registrosError}
          </span>
        </Td>
        <Td className={estilos.quien}>{carga.subidoPor ?? SIN_DATO}</Td>
        <Td className={estilos.fecha}>{formatearInstante(carga.createdAt)}</Td>
      </tr>
      {desplegada ? (
        <tr>
          <Td colSpan={COLUMNAS} className={estilos.detalle}>
            <DetalleRechazo cargaId={carga.id} />
          </Td>
        </tr>
      ) : null}
    </Fragment>
  );
}
