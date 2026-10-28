import { formatearMonto } from '@/shared/dinero';
import {
  MARCA_LINEAS_NO_LEIDAS,
  RESUMEN_LECTURA_PDF,
  SALDO_FINAL,
  SALDO_INICIAL,
  SIN_DATO,
} from '@/features/cargas/textos';
import estilos from './resultado.module.css';

export interface ResultadoLecturaPdfProps {
  movimientosLeidos: number;
  lineasNoLeidas: number;
  /** Decimal en cadena, tal como lo envía la API. Nunca un `number`. */
  saldoInicial: string;
  saldoFinal: string;
}

/** Un saldo con miles y dos decimales, sin `$` (como el mockup); sin pasar por flotante. */
const saldo = (valor: string): string =>
  formatearMonto(valor, { moneda: false })?.texto ?? SIN_DATO;

/**
 * Lo que se leyó de un PDF (historia 3.2): los conteos, los dos saldos y, solo
 * si alguna línea no se pudo leer, la marca de advertencia. Nada se importó.
 * Las cifras y los saldos no se parten y la caja crece con el número.
 */
export function ResultadoLecturaPdf({
  movimientosLeidos,
  lineasNoLeidas,
  saldoInicial,
  saldoFinal,
}: ResultadoLecturaPdfProps) {
  return (
    <div className={estilos.caja}>
      <p className={estilos.resumen}>
        <span className={estilos.cifra}>{movimientosLeidos}</span>{' '}
        {RESUMEN_LECTURA_PDF.movimientos}{' '}
        <span className={estilos.cifra}>{lineasNoLeidas}</span>{' '}
        {RESUMEN_LECTURA_PDF.lineas}
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
      {lineasNoLeidas > 0 ? (
        <span className={estilos.advertencia}>
          <span aria-hidden="true">⚠</span>
          <span className={estilos.cifra}>{lineasNoLeidas}</span>{' '}
          {MARCA_LINEAS_NO_LEIDAS}
        </span>
      ) : null}
    </div>
  );
}
