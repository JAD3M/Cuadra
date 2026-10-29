import { formatearMonto } from '@/shared/dinero';
import {
  DIFERENCIA,
  LINEAS_NO_LEIDAS_TITULO,
  SALDO_ESPERADO,
  SALDO_FINAL_PDF,
  SIN_DATO,
} from '@/features/cargas/textos';
import estilos from './DetalleRechazoPdf.module.css';

/** Una línea del PDF que el lector no pudo leer. */
export interface LineaNoLeida {
  linea: number;
  texto: string;
}

export interface SaldosRechazo {
  /** Decimales en cadena, tal como llegan; nunca `number`. */
  saldoFinal?: string;
  saldoEsperado: string;
  diferencia: string;
}

export interface DetalleRechazoPdfProps {
  /** Solo en `saldos_no_cuadran`. */
  saldos?: SaldosRechazo;
  /** Las líneas que el lector no pudo leer; vacío no pinta la lista. */
  lineas: readonly LineaNoLeida[];
}

/** Un monto con miles y dos decimales, sin `$`, sin pasar por flotante. */
const monto = (valor: string): string =>
  formatearMonto(valor, { moneda: false })?.texto ?? SIN_DATO;

function Fila({
  rotulo,
  valor,
  peligro = false,
}: {
  rotulo: string;
  valor: string;
  peligro?: boolean;
}) {
  return (
    <div className={estilos.fila}>
      <dt className={estilos.rotulo}>{rotulo}</dt>
      <dd className={peligro ? estilos.valorPeligro : estilos.valor}>
        {monto(valor)}
      </dd>
    </div>
  );
}

/**
 * Lo que acompaña el título y el mensaje de un PDF rechazado (historia 3.3):
 * los montos del cuadre y las líneas que no se pudieron leer. Todo texto del
 * PDF se pinta como texto plano de React.
 */
export function DetalleRechazoPdf({ saldos, lineas }: DetalleRechazoPdfProps) {
  if (saldos === undefined && lineas.length === 0) return null;
  return (
    <div className={estilos.detalle}>
      {saldos !== undefined ? (
        <dl className={estilos.saldos}>
          {saldos.saldoFinal !== undefined ? (
            <Fila rotulo={SALDO_FINAL_PDF} valor={saldos.saldoFinal} />
          ) : null}
          <Fila rotulo={SALDO_ESPERADO} valor={saldos.saldoEsperado} />
          <Fila rotulo={DIFERENCIA} valor={saldos.diferencia} peligro />
        </dl>
      ) : null}
      {lineas.length > 0 ? (
        <>
          <span className={estilos.rotulo}>{LINEAS_NO_LEIDAS_TITULO}</span>
          <ul className={estilos.lineas}>
            {lineas.map(({ linea, texto }) => (
              <li key={linea}>
                Línea {linea} · {texto}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
