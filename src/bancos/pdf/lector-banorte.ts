import {
  CODIGO_MONEDA_NO_MXN,
  EstadoDeCuentaRechazado,
  MENSAJE_MONEDA_NO_MXN,
  MENSAJE_SIN_SALDOS,
  type MovimientoLeido,
} from '../lector-estado-cuenta';
import type { Dinero } from '../../common/dinero';
import {
  aDinero,
  IMPORTE,
  MESES,
  type EstadoCuentaLeido,
  type LineaNoLeida,
} from './lector-comun';

/**
 * Lector puro de Banorte, cuenta empresarial (AD-8): recibe el texto ya
 * extraído del PDF y devuelve saldos, movimientos y las líneas que no pudo
 * leer. Sin I/O ni librerías.
 *
 * SINTÉTICO [SUPUESTO]: no hay un PDF real de Banorte en el repositorio; el
 * layout es el que se acordó para la historia 8.1 y hay que validarlo con un
 * estado de cuenta empresarial anonimizado. El texto extraído pierde la
 * columna cargo/abono, así que el signo sale del saldo corrido y, si una
 * línea no cuadra, no se adivina: va a `lineasNoLeidas` (un falso positivo es
 * peor que no conciliar).
 */

const BANCO = /^BANORTE$/i;
const TITULO_EMPRESARIAL = /^ESTADO DE CUENTA EMPRESARIAL$/i;
const PERIODO = /^Periodo:\s+\d{2}\/\d{2}\/\d{4}\s+al\s+\d{2}\/\d{2}\/\d{4}$/i;
const MONEDA = /^Moneda:\s+(\S+)$/i;
const SALDO_INICIAL = new RegExp(`^Saldo\\s+inicial:\\s+(${IMPORTE})$`, 'i');
const SALDO_FINAL = new RegExp(`^Saldo\\s+final:\\s+(${IMPORTE})$`, 'i');
const MOVIMIENTO = new RegExp(
  `^(\\d{2})-([A-Z]{3})-(\\d{4})\\s+(.+?)\\s+(${IMPORTE})\\s+(${IMPORTE})$`,
);
const REFERENCIA = /^(.*?)\s+REF\s+(\S.*)$/;
/** Rótulos que no son movimientos ni encabezado y no merecen reporte. */
const RUIDO = /^(DOCUMENTO SINT[ÉE]TICO|FECHA\b)/i;

const MENSAJE_DISENO =
  'El PDF no tiene el diseño de un estado de cuenta empresarial de Banorte. Descarga el estado de cuenta de la cuenta empresarial desde Banorte en su Empresa y vuelve a subirlo.';

export function leerEstadoCuentaBanorte(texto: string): EstadoCuentaLeido {
  const lineas = texto.split(/\r\n|\r|\n/);
  let esBanorte = false;
  let esEmpresarial = false;
  let hayPeriodo = false;
  let moneda: string | null = null;
  let saldoInicial: string | null = null;
  let saldoFinal: string | null = null;

  const candidatas: Array<{ linea: number; texto: string }> = [];
  lineas.forEach((cruda, i) => {
    const t = cruda.trim();
    if (t === '') return;
    if (BANCO.test(t)) {
      esBanorte = true;
      return;
    }
    if (TITULO_EMPRESARIAL.test(t)) {
      esEmpresarial = true;
      return;
    }
    if (PERIODO.test(t)) {
      hayPeriodo = true;
      return;
    }
    const m = MONEDA.exec(t);
    if (m) {
      moneda = m[1].toUpperCase();
      return;
    }
    const si = SALDO_INICIAL.exec(t);
    if (si) {
      saldoInicial = si[1];
      return;
    }
    const sf = SALDO_FINAL.exec(t);
    if (sf) {
      saldoFinal = sf[1];
      return;
    }
    if (RUIDO.test(t)) return;
    candidatas.push({ linea: i + 1, texto: t });
  });

  if (!esBanorte || !esEmpresarial) {
    throw new EstadoDeCuentaRechazado(MENSAJE_DISENO);
  }
  if (moneda !== 'MXN') {
    throw new EstadoDeCuentaRechazado(
      MENSAJE_MONEDA_NO_MXN,
      CODIGO_MONEDA_NO_MXN,
    );
  }
  if (!hayPeriodo || saldoInicial === null || saldoFinal === null) {
    throw new EstadoDeCuentaRechazado(MENSAJE_SIN_SALDOS);
  }

  const inicial = aDinero(saldoInicial);
  const movimientos: MovimientoLeido[] = [];
  const lineasNoLeidas: LineaNoLeida[] = [];
  let anterior = inicial;

  for (const { linea, texto: t } of candidatas) {
    const movimiento = leerMovimiento(t, anterior);
    if (!movimiento) {
      lineasNoLeidas.push({ linea, texto: t });
      continue;
    }
    movimientos.push(movimiento.movimiento);
    anterior = movimiento.saldo;
  }

  return {
    saldoInicial: inicial.toFixed(2),
    saldoFinal: aDinero(saldoFinal).toFixed(2),
    movimientos,
    lineasNoLeidas,
  };
}

/**
 * Un movimiento, o null si no tiene la forma, la fecha no existe o el importe
 * no cuadra con el saldo corrido. Una línea que no cuadra no mueve el saldo
 * corrido: las siguientes también se reportan en vez de adivinar.
 */
function leerMovimiento(
  linea: string,
  anterior: Dinero,
): { movimiento: MovimientoLeido; saldo: Dinero } | null {
  const partes = MOVIMIENTO.exec(linea);
  if (!partes) return null;
  const [, dia, abreviatura, anio, cuerpo, textoImporte, textoSaldo] = partes;

  const fecha = fechaDelMovimiento(Number(dia), abreviatura, Number(anio));
  if (!fecha) return null;

  const importe = aDinero(textoImporte).abs();
  const saldo = aDinero(textoSaldo);
  const delta = saldo.minus(anterior);
  // Importe 0 o diferencia distinta del importe: no se sabe qué pasó.
  if (importe.isZero() || !delta.abs().equals(importe)) return null;

  const conReferencia = REFERENCIA.exec(cuerpo);
  const descripcion = (conReferencia ? conReferencia[1] : cuerpo).trim();
  if (descripcion === '') return null;

  return {
    movimiento: {
      fecha,
      descripcion,
      referencia: conReferencia ? conReferencia[2].trim() : null,
      monto: delta.toFixed(2),
    },
    saldo,
  };
}

/** AAAA-MM-DD, o null si el mes o el día no existen. */
function fechaDelMovimiento(
  dia: number,
  abreviatura: string,
  anio: number,
): string | null {
  const mes = MESES[abreviatura];
  if (!mes) return null;
  // Día 0 del mes siguiente = último día de este. Solo calendario, no dinero.
  if (dia < 1 || dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
