import { formatearInstante } from '@/features/caso/fecha';
import {
  esActiva,
  ETIQUETAS_ESTADO_CARGA,
  ETIQUETAS_TIPO_CARGA,
  type EstadoCarga,
  type TipoCarga,
} from '@/shared/dominio';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { Td } from '@/shared/ui/Tabla';
import { SIN_DATO } from '@/features/cargas/textos';
import { TONO_ESTADO_CARGA } from '@/features/cargas/tonos';
import { BarraAvance } from './BarraAvance';
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
}

export interface FilaCargaProps {
  carga: FilaHistorial;
}

/**
 * Fila de solo lectura: no abre ni decide nada. Mientras la carga está activa
 * (pendiente o procesando) los contadores se muestran «—»: el servidor los
 * escribe una sola vez, al terminar (M12). Terminada, salen tal como llegaron.
 * El nombre del archivo es texto plano; el CSS lo trunca a la vista, pero el
 * texto completo sigue en el DOM.
 */
export function FilaCarga({ carga }: FilaCargaProps) {
  const activa = esActiva(carga.estado);
  const resaltaError = !activa && carga.registrosError > 0;
  return (
    <tr>
      <Td>{ETIQUETAS_TIPO_CARGA[carga.tipo]}</Td>
      <Td className={estilos.archivo}>
        <span className={estilos.nombre} title={carga.nombreArchivo}>
          {carga.nombreArchivo}
        </span>
      </Td>
      <Td>
        <EstadoChip tono={TONO_ESTADO_CARGA[carga.estado]}>
          {ETIQUETAS_ESTADO_CARGA[carga.estado]}
        </EstadoChip>
      </Td>
      <Td>
        <BarraAvance estado={carga.estado} />
      </Td>
      <Td numerica>
        <span
          className={`${estilos.contador} ${activa ? estilos.atenuado : ''}`}
        >
          {activa ? SIN_DATO : carga.registrosOk}
        </span>
      </Td>
      <Td numerica>
        <span
          className={`${estilos.contador} ${
            resaltaError ? estilos.conError : estilos.atenuado
          }`}
        >
          {activa ? SIN_DATO : carga.registrosError}
        </span>
      </Td>
      <Td className={estilos.quien}>{carga.subidoPor ?? SIN_DATO}</Td>
      <Td className={estilos.fecha}>{formatearInstante(carga.createdAt)}</Td>
    </tr>
  );
}
