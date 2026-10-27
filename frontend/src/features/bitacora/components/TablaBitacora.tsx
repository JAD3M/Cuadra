import { ACCION_ACCESO_DENEGADO, type AccionBitacora } from '@/shared/dominio';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { formatearInstante } from '@/features/caso/fecha';
import { detalleEvento, segmentosDeDetalle } from '@/features/bitacora/detalle';
import {
  CARGANDO,
  COLUMNAS,
  NOMBRE_TABLA,
  SISTEMA,
} from '@/features/bitacora/textos';
import { textoAccion } from '@/features/bitacora/textoAccion';
import { TONOS_ACCION } from '@/features/bitacora/tonos';
import estilos from './TablaBitacora.module.css';

/** Lo que la tabla necesita de un evento; el evento del contrato lo cumple. */
export interface EventoTabla {
  id: string;
  entidad: string;
  entidadId: string;
  accion: AccionBitacora;
  /** JSON libre del servidor: solo lo interpreta `detalleEvento`. */
  datos: unknown;
  /** Instante ISO UTC. */
  createdAt: string;
  /** `null` cuando el actor fue el sistema o la persona ya no existe. */
  usuario: { nombre: string } | null;
}

/** Filas de relleno de la carga inicial (maqueta: cinco). */
const FILAS_DE_RELLENO = 5;

export interface TablaBitacoraProps {
  /** Eventos en el orden del servidor (más nuevo primero): la tabla no reordena. */
  eventos: readonly EventoTabla[];
  /** Primera carga: relleno con un estado anunciado y ninguna fila de datos. */
  cargando?: boolean;
  /** Zona IANA para «Cuándo»; sin ella, la del navegador (las pruebas la fijan). */
  zona?: string;
}

/** El detalle con cada monto en un elemento que no se parte. */
function Detalle({ texto }: { texto: string }) {
  return (
    <>
      {segmentosDeDetalle(texto).map((segmento, indice) =>
        segmento.monto ? (
          <span key={indice} className={estilos.monto}>
            {segmento.texto}
          </span>
        ) : (
          segmento.texto
        ),
      )}
    </>
  );
}

function FilaEvento({ evento, zona }: { evento: EventoTabla; zona?: string }) {
  const denegado = evento.accion === ACCION_ACCESO_DENEGADO;
  const tono = TONOS_ACCION[evento.accion];
  return (
    <tr
      className={`${estilos.fila}${denegado ? ` ${estilos.filaDenegada}` : ''}`}
      data-accion={evento.accion}
    >
      <Td className={estilos.cuando}>
        <time dateTime={evento.createdAt}>
          {formatearInstante(evento.createdAt, zona)}
        </time>
      </Td>
      <Td className={evento.usuario === null ? estilos.sistema : estilos.quien}>
        {evento.usuario?.nombre ?? SISTEMA}
      </Td>
      <Td>
        <span className={`${estilos.chip} ${estilos[tono]}`} data-tono={tono}>
          {textoAccion(evento.accion)}
        </span>
      </Td>
      <Td>
        <span className={estilos.entidad}>{evento.entidad}</span>
        <div className={estilos.entidadId}>{evento.entidadId}</div>
      </Td>
      <Td className={estilos.detalle}>
        <Detalle texto={detalleEvento(evento)} />
      </Td>
    </tr>
  );
}

/**
 * Tabla de eventos de la bitácora. Presentacional y de solo lectura: recibe
 * los eventos validados por el contrato, deriva el detalle con
 * `detalleEvento` (que nunca lanza) y pinta todo texto del usuario como
 * texto. La fila de un acceso denegado lleva su fondo de peligro.
 */
export function TablaBitacora({
  eventos,
  cargando = false,
  zona,
}: TablaBitacoraProps) {
  if (cargando) {
    return (
      <div className={estilos.esqueleto} role="status">
        <span className={estilos.ocultoVisual}>{CARGANDO}</span>
        {Array.from({ length: FILAS_DE_RELLENO }, (_, i) => (
          <div key={i} className={estilos.barra} />
        ))}
      </div>
    );
  }

  return (
    <Tabla titulo={NOMBRE_TABLA}>
      <thead>
        <tr>
          <Th>{COLUMNAS.cuando}</Th>
          <Th>{COLUMNAS.usuario}</Th>
          <Th>{COLUMNAS.accion}</Th>
          <Th>{COLUMNAS.entidad}</Th>
          <Th>{COLUMNAS.detalle}</Th>
        </tr>
      </thead>
      <tbody>
        {eventos.map((evento) => (
          <FilaEvento key={evento.id} evento={evento} zona={zona} />
        ))}
      </tbody>
    </Tabla>
  );
}
