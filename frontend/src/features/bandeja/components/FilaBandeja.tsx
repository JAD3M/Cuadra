import { Link } from 'react-router';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { ETIQUETAS_ESTADO_BANDEJA } from '@/shared/dominio';
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
  regla: string | null;
  motivo: string | null;
  mejorPropuesta: {
    diferenciaMonto: string | null;
    cfdi: CfdiEtiquetable;
  } | null;
}

const GLIFOS: Record<EstadoBandeja, string> = {
  sugerencia: '●',
  sin_match: '○',
  conciliado: '✓',
};

export interface FilaBandejaProps {
  fila: FilaTabla;
}

/** Fila de solo lectura: ningún control decide, confirma ni cierra el caso. */
export function FilaBandeja({ fila }: FilaBandejaProps) {
  const insignia = insigniaIa(fila.regla, fila.motivo);
  const propuesta = fila.mejorPropuesta;
  return (
    <tr>
      <Td className={estilos.fecha}>{formatearFecha(fila.fecha)}</Td>
      <Td>
        <Link
          className={estilos.enlace}
          to={`/casos/${encodeURIComponent(fila.movimientoId)}`}
        >
          {fila.descripcion}
        </Link>
        <div className={estilos.referencia}>
          {fila.referencia === null
            ? SIN_REFERENCIA
            : `${PREFIJO_REFERENCIA} ${fila.referencia}`}
        </div>
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
        <EstadoChip tono={fila.estado}>
          <span aria-hidden="true">{GLIFOS[fila.estado]}</span>
          {ETIQUETAS_ESTADO_BANDEJA[fila.estado]}
        </EstadoChip>
      </Td>
      <Td>
        <div className={estilos.reglaFila}>
          <span className={estilos.regla}>{fila.regla ?? SIN_DATO}</span>
          {insignia === null ? null : (
            <InsigniaIa simulada={insignia === 'ia_simulada'} />
          )}
        </div>
      </Td>
      <Td className={estilos.cfdi}>{etiquetaCfdi(propuesta?.cfdi ?? null)}</Td>
      <Td numerica className={estilos.diferencia}>
        <CeldaDiferencia valor={propuesta?.diferenciaMonto} />
      </Td>
    </tr>
  );
}
