import { dinero, type Dinero } from '../../common/dinero';
import {
  CODIGO_MONEDA_NO_MXN,
  EstadoDeCuentaRechazado,
  MENSAJE_MONEDA_NO_MXN,
  type MovimientoLeido,
} from '../lector-estado-cuenta';

/**
 * Lector puro de BBVA (AD-8): recibe el texto ya extraído del PDF y devuelve
 * saldos, movimientos y las líneas que no pudo leer. Sin I/O ni librerías.
 *
 * SINTÉTICO: el layout es el acordado en la historia 3.2, no el formato real
 * de BBVA; hay que validarlo con un PDF real. El texto extraído pierde la
 * columna cargo/abono, así que el signo sale del saldo corrido y, si una
 * línea no cuadra, no se adivina: va a `lineasNoLeidas` (un falso positivo es
 * peor que no conciliar).
 */

export interface LineaNoLeida {
  /** Línea del texto extraído, desde 1. */
  linea: number;
  texto: string;
}

export interface EstadoCuentaLeido {
  saldoInicial: string;
  saldoFinal: string;
  movimientos: MovimientoLeido[];
  lineasNoLeidas: LineaNoLeida[];
}

const MESES: Record<string, number> = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
};

const IMPORTE = String.raw`-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2}`;
const PERIODO =
  /^Periodo\s+DEL\s+(\d{2})\/(\d{2})\/(\d{4})\s+AL\s+(\d{2})\/(\d{2})\/(\d{4})$/i;
const MONEDA = /^Moneda\s+(\S+)$/i;
const SALDO_ANTERIOR = new RegExp(`^Saldo\\s+Anterior\\s+(${IMPORTE})$`, 'i');
const SALDO_FINAL = new RegExp(`^Saldo\\s+Final\\s+(${IMPORTE})$`, 'i');
const MOVIMIENTO = new RegExp(
  `^(\\d{2})/([A-Z]{3})\\s+\\d{2}/[A-Z]{3}\\s+(.+?)\\s+(${IMPORTE})\\s+(${IMPORTE})$`,
);
const REFERENCIA = /^(.*?)\s+Ref\.\s+(\S.*)$/;
/** Rótulos que no son movimientos ni encabezado y no merecen reporte. */
const RUIDO = /^(DOCUMENTO SINT[ÉE]TICO|BBVA\b|ESTADO DE CUENTA\b|FECHA\b)/i;

interface Periodo {
  inicio: { anio: number; mes: number };
  fin: { anio: number; mes: number };
}

export function leerEstadoCuentaBbva(texto: string): EstadoCuentaLeido {
  const lineas = texto.split(/\r\n|\r|\n/);
  let periodo: Periodo | null = null;
  let moneda: string | null = null;
  let saldoInicial: string | null = null;
  let saldoFinal: string | null = null;

  const candidatas: Array<{ linea: number; texto: string }> = [];
  lineas.forEach((cruda, i) => {
    const t = cruda.trim();
    if (t === '') return;
    const p = PERIODO.exec(t);
    if (p) {
      periodo = {
        inicio: { anio: Number(p[3]), mes: Number(p[2]) },
        fin: { anio: Number(p[6]), mes: Number(p[5]) },
      };
      return;
    }
    const m = MONEDA.exec(t);
    if (m) {
      moneda = m[1].toUpperCase();
      return;
    }
    const sa = SALDO_ANTERIOR.exec(t);
    if (sa) {
      saldoInicial = sa[1];
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

  if (moneda !== 'MXN') {
    throw new EstadoDeCuentaRechazado(
      MENSAJE_MONEDA_NO_MXN,
      CODIGO_MONEDA_NO_MXN,
    );
  }
  if (!periodo || saldoInicial === null || saldoFinal === null) {
    throw new EstadoDeCuentaRechazado(
      'No encontramos el periodo o los saldos del estado de cuenta. Descarga el PDF de nuevo desde el portal del banco y vuelve a subirlo.',
    );
  }

  const inicial = aDinero(saldoInicial);
  const movimientos: MovimientoLeido[] = [];
  const lineasNoLeidas: LineaNoLeida[] = [];
  let anterior = inicial;

  for (const { linea, texto: t } of candidatas) {
    const movimiento = leerMovimiento(t, periodo, anterior);
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
  periodo: Periodo,
  anterior: Dinero,
): { movimiento: MovimientoLeido; saldo: Dinero } | null {
  const partes = MOVIMIENTO.exec(linea);
  if (!partes) return null;
  const [, dia, abreviatura, cuerpo, textoImporte, textoSaldo] = partes;

  const fecha = fechaDelMovimiento(Number(dia), abreviatura, periodo);
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

/** AAAA-MM-DD; el año sale del periodo (a caballo entre años: el del mes). */
function fechaDelMovimiento(
  dia: number,
  abreviatura: string,
  periodo: Periodo,
): string | null {
  const mes = MESES[abreviatura];
  if (!mes) return null;
  const { inicio, fin } = periodo;
  const anio =
    fin.anio > inicio.anio && mes < inicio.mes ? fin.anio : inicio.anio;
  // Día 0 del mes siguiente = último día de este. Solo calendario, no dinero.
  if (dia < 1 || dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()) {
    return null;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function aDinero(texto: string): Dinero {
  return dinero(texto.replace(/,/g, ''));
}
