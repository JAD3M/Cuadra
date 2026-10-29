import { Link } from 'react-router';
import { formatearMonto } from '@/shared/dinero';
import { ETIQUETAS_ESTADO_CARGA, type EstadoCarga } from '@/shared/dominio';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import {
  RESUMEN_LECTURA_PDF,
  REVISAR_VISTA_PREVIA,
  SALDO_FINAL,
  SALDO_INICIAL,
  SIN_DATO,
} from '@/features/cargas/textos';
import { rutaVistaPrevia } from '@/features/cargas/rutas';
import { TONO_ESTADO_CARGA } from '@/features/cargas/tonos';
import estilos from './resultado.module.css';

export interface ResultadoLecturaPdfProps {
  movimientosLeidos: number;
  /** Decimal en cadena, tal como lo envía la API. Nunca un `number`. */
  saldoInicial: string;
  saldoFinal: string;
  /** Estado de la carga guardada, tal como lo manda el servidor. */
  estado: EstadoCarga;
  /** Id de la carga guardada: a dónde lleva «Revisar vista previa». */
  cargaId: string;
}

/** Un saldo con miles y dos decimales, sin `$` (como el mockup); sin pasar por flotante. */
const saldo = (valor: string): string =>
  formatearMonto(valor, { moneda: false })?.texto ?? SIN_DATO;

/**
 * Un PDF que cuadró y quedó guardado (historia 3.3): los movimientos leídos,
 * los dos saldos, el estado de la carga y la pista de que sus movimientos
 * esperan la vista previa. Las cifras no se parten y la caja crece con el
 * número.
 */
export function ResultadoLecturaPdf({
  movimientosLeidos,
  saldoInicial,
  saldoFinal,
  estado,
  cargaId,
}: ResultadoLecturaPdfProps) {
  return (
    <div className={estilos.caja}>
      <p className={estilos.resumen}>
        <span className={estilos.cifra}>{movimientosLeidos}</span>{' '}
        {RESUMEN_LECTURA_PDF.movimientos} {RESUMEN_LECTURA_PDF.cuadran}
      </p>
      <dl className={estilos.saldos}>
        <div className={estilos.saldoFila}>
          <dt className={estilos.saldoRotulo}>{SALDO_INICIAL}</dt>
          <dd className={estilos.saldoValor}>{saldo(saldoInicial)}</dd>
        </div>
        <div className={estilos.saldoFila}>
          <dt className={estilos.saldoRotulo}>{SALDO_FINAL}</dt>
          <dd className={estilos.saldoValor}>{saldo(saldoFinal)}</dd>
        </div>
      </dl>
      <span className={estilos.chipEstado}>
        <EstadoChip tono={TONO_ESTADO_CARGA[estado]}>
          {ETIQUETAS_ESTADO_CARGA[estado]}
        </EstadoChip>
      </span>
      <span className={estilos.pista}>{RESUMEN_LECTURA_PDF.espera}</span>
      {estado === 'pendiente_vista_previa' ? (
        <Link className={estilos.revisar} to={rutaVistaPrevia(cargaId)}>
          {REVISAR_VISTA_PREVIA}
        </Link>
      ) : null}
    </div>
  );
}
