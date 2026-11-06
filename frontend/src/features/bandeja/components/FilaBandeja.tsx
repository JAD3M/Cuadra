import { Link } from 'react-router';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { ETIQUETAS_ESTADO_BANDEJA } from '@/shared/dominio';
import {
  ETIQUETA_REQUIERE_REVISION,
  ETIQUETAS_MOTIVO_BLOQUEO,
  ETIQUETAS_MOTIVO_REVISION,
  GLIFO_REQUIERE_REVISION,
  ROTULO_MOTIVO_REVISION,
} from '@/shared/dominio/etiquetas';
import type { MotivoBloqueo, MotivoRevision } from '@/shared/dominio/tipos';
import { Td } from '@/shared/ui/Tabla';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { Monto } from '@/shared/ui/Monto';
import { MONEDA_BASE } from '@/features/bandeja/constantes';
import {
  etiquetaCfdi,
  type CfdiEtiquetable,
} from '@/features/bandeja/etiquetaCfdi';
import { formatearFecha } from '@/features/bandeja/fecha';
import { insigniaIa } from '@/features/bandeja/ia';
import {
  LOTE,
  PREFIJO_REFERENCIA,
  SIN_DATO,
  SIN_REFERENCIA,
} from '@/features/bandeja/textos';
import { CeldaDiferencia } from './CeldaDiferencia';
import { InsigniaIa } from './InsigniaIa';
import estilos from './TablaBandeja.module.css';

/** Lo que la tabla necesita de una fila; la fila del contrato la cumple. */
export interface FilaTabla {
  movimientoId: string;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  moneda: string;
  estado: EstadoBandeja;
  /** Confirmada con la factura cancelada: el chip pide revisión. */
  requiereRevision?: boolean;
  /** Por qué pide revisión; solo si el servidor lo afirma. */
  motivoRevision?: MotivoRevision | null;
  /** Por qué ESTA persona no puede confirmarla; solo se muestra en el lote. */
  motivoBloqueo?: MotivoBloqueo | null;
  regla: string | null;
  motivo: string | null;
  mejorPropuesta: {
    /** Id de la propuesta: lo que el lote manda a confirmar. */
    conciliacionId?: string;
    diferenciaMonto: string | null;
    cfdi: CfdiEtiquetable;
  } | null;
}

/** Lo que la fila necesita del modo lote (5.3). Ausente = modo normal. */
export interface LoteDeFila {
  /** La fila entra al lote: lleva casilla. Si no, la celda queda vacía. */
  conCasilla: boolean;
  marcada: boolean;
  deshabilitada: boolean;
  onAlternar: () => void;
}

const GLIFOS: Record<EstadoBandeja, string> = {
  sugerencia: '●',
  sin_match: '○',
  conciliado: '✓',
};

export interface FilaBandejaProps {
  fila: FilaTabla;
  lote?: LoteDeFila;
}

/**
 * Fila de la bandeja. En el modo normal es de solo lectura; en el lote suma una
 * casilla, que solo propone: confirmar pasa por la API y la decide el servidor.
 */
export function FilaBandeja({ fila, lote }: FilaBandejaProps) {
  const insignia = insigniaIa(fila.regla, fila.motivo);
  const propuesta = fila.mejorPropuesta;
  const referencia =
    fila.referencia === null
      ? SIN_REFERENCIA
      : `${PREFIJO_REFERENCIA} ${fila.referencia}`;
  return (
    <tr>
      {lote ? (
        <Td
          className={
            lote.marcada
              ? `${estilos.celdaCasilla} ${estilos.filaMarcada}`
              : estilos.celdaCasilla
          }
        >
          {lote.conCasilla ? (
            <label className={estilos.casilla}>
              <input
                type="checkbox"
                className={estilos.checkbox}
                checked={lote.marcada}
                disabled={lote.deshabilitada}
                onChange={lote.onAlternar}
                aria-label={LOTE.incluir(fila.descripcion, referencia)}
              />
            </label>
          ) : null}
        </Td>
      ) : null}
      <Td className={estilos.fecha}>{formatearFecha(fila.fecha)}</Td>
      <Td>
        <Link
          className={estilos.enlace}
          to={`/casos/${encodeURIComponent(fila.movimientoId)}`}
        >
          {fila.descripcion}
        </Link>
        <div className={estilos.referencia}>{referencia}</div>
      </Td>
      <Td numerica>
        <span className={estilos.monto}>
          <Monto
            valor={fila.monto}
            codigoMoneda={fila.moneda === MONEDA_BASE ? undefined : fila.moneda}
          />
        </span>
      </Td>
      <Td>
        {fila.requiereRevision === true ? (
          <EstadoChip tono="sin_match">
            <span aria-hidden="true">{GLIFO_REQUIERE_REVISION}</span>
            {ETIQUETA_REQUIERE_REVISION}
          </EstadoChip>
        ) : (
          <EstadoChip tono={fila.estado}>
            <span aria-hidden="true">{GLIFOS[fila.estado]}</span>
            {ETIQUETAS_ESTADO_BANDEJA[fila.estado]}
          </EstadoChip>
        )}
      </Td>
      <Td>
        <div className={estilos.reglaFila}>
          <span className={estilos.regla}>{fila.regla ?? SIN_DATO}</span>
          {insignia === null ? null : (
            <InsigniaIa simulada={insignia === 'ia_simulada'} />
          )}
        </div>
        {fila.requiereRevision === true && fila.motivoRevision ? (
          <div className={estilos.motivoRevision}>
            {ROTULO_MOTIVO_REVISION}{' '}
            {ETIQUETAS_MOTIVO_REVISION[fila.motivoRevision]}
          </div>
        ) : null}
        {lote && fila.motivoBloqueo ? (
          <div className={estilos.motivoRevision}>
            {ETIQUETAS_MOTIVO_BLOQUEO[fila.motivoBloqueo]}
          </div>
        ) : null}
      </Td>
      <Td className={estilos.cfdi}>{etiquetaCfdi(propuesta?.cfdi ?? null)}</Td>
      <Td numerica className={estilos.diferencia}>
        <CeldaDiferencia valor={propuesta?.diferenciaMonto} />
      </Td>
    </tr>
  );
}
