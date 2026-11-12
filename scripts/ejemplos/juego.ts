import { aTexto, dinero } from '../../src/common/dinero';
import {
  ALFA,
  BETA,
  DELTA,
  EPSILON,
  GAMA,
  ZETA,
  type CfdiDemo,
  type ClienteDemo,
  type MovimientoDemo,
} from '../demo/escenarios';
import { totalDe } from '../demo/formatos';

/**
 * Historia 7.1. El juego de ejemplo de BBVA: un mes (septiembre de 2026) de
 * Ferretería que cuenta una historia completa. Única fuente de verdad: de aquí
 * salen el PDF, el CSV equivalente y los CFDI (generar.ts), y lo que se espera
 * que el motor haga con cada movimiento (`esperado`). Todo es SINTÉTICO.
 *
 * Si el motor no produce lo declarado, se corrige el dato, nunca el motor.
 */

export const SALDO_ANTERIOR = '10000.00';
/** Se suma al saldo final del PDF que no cuadra (la diferencia que debe detectar el cuadre). */
export const DIFERENCIA_NO_CUADRA = '100.00';

const PERIODO = { inicio: '2026-09-01', fin: '2026-09-30' } as const;
export { PERIODO };

function factura(
  folio: string,
  fecha: string,
  importe: string,
  receptor: ClienteDemo,
  extra: Partial<Pick<CfdiDemo, 'moneda' | 'tipoCambio' | 'cancelado'>> = {},
): CfdiDemo {
  return {
    empresa: 'fdb',
    serie: 'A',
    folio,
    fecha,
    hora: '10:30:00',
    receptor,
    conceptos: [{ descripcion: 'Material de ferretería', importe }],
    moneda: extra.moneda ?? 'MXN',
    tipoCambio: extra.tipoCambio,
    metodoPago: 'PUE',
    cancelado: extra.cancelado,
  };
}

export const FACTURAS: readonly CfdiDemo[] = [
  // Regla 1: referencia y monto exactos.
  factura('5001', '2026-08-28', '1000.00', ALFA),
  // Regla 2: la referencia coincide, el monto no.
  factura('5002', '2026-08-29', '2000.00', BETA),
  // Regla 3: sin referencia, monto único.
  factura('5003', '2026-08-30', '3000.00', GAMA),
  // Un depósito que cubre varias facturas (580.00 + 812.00).
  factura('5004', '2026-09-01', '500.00', DELTA),
  factura('5005', '2026-09-02', '700.00', DELTA),
  // Ambiguo: dos facturas con el mismo total y un depósito sin referencia.
  factura('5006', '2026-09-03', '800.00', EPSILON),
  factura('5007', '2026-09-04', '800.00', EPSILON),
  // Cancelada: el depósito la nombra por referencia, pero ya no vale.
  factura('5008', '2026-09-05', '1500.00', ZETA, { cancelado: true }),
  // En dólares: Cuadra solo concilia pesos.
  factura('5009', '2026-09-06', '2500.00', ZETA, {
    moneda: 'USD',
    tipoCambio: '17.500000',
  }),
];

export interface MovimientoEjemplo extends MovimientoDemo {
  /** Qué se espera del movimiento tras conciliar. */
  esperado:
    | { estado: 'sugerencia'; regla: string }
    | { estado: 'sin_match' }
    | { estado: 'fuera'; clase?: 'comision' };
}

const mov = (
  fecha: string,
  descripcion: string,
  referencia: string,
  monto: string,
  esperado: MovimientoEjemplo['esperado'],
): MovimientoEjemplo => ({
  empresa: 'fdb',
  archivo: 1,
  fecha,
  descripcion,
  referencia,
  monto,
  esperado,
});

export const MOVIMIENTOS: readonly MovimientoEjemplo[] = [
  mov('2026-09-01', 'SPEI RECIBIDO CLIENTE ALFA', 'A5001', '1160.00', {
    estado: 'sugerencia',
    regla: 'referencia_monto_exacto',
  }),
  mov('2026-09-03', 'TRANSFERENCIA RECIBIDA CLIENTE BETA', 'A5002', '2300.00', {
    estado: 'sugerencia',
    regla: 'referencia_monto_diferente',
  }),
  mov('2026-09-05', 'SPEI RECIBIDO CLIENTE GAMA', '', '3480.00', {
    estado: 'sugerencia',
    regla: 'monto_unico',
  }),
  mov('2026-09-08', 'DEPOSITO CLIENTE DELTA', '', '1392.00', {
    estado: 'sugerencia',
    regla: 'suma_grupo',
  }),
  mov('2026-09-10', 'SPEI RECIBIDO CLIENTE EPSILON', '', '928.00', {
    estado: 'sin_match',
  }),
  mov('2026-09-12', 'SPEI RECIBIDO CLIENTE ZETA', 'A5008', '1740.00', {
    estado: 'sin_match',
  }),
  mov('2026-09-15', 'COMISION MANEJO DE CUENTA', '', '-350.00', {
    estado: 'fuera',
    clase: 'comision',
  }),
  mov('2026-09-20', 'PAGO PROVEEDOR MATERIAL', '', '-2000.00', {
    estado: 'fuera',
  }),
];

/** Saldo final del estado de cuenta que sí cuadra. */
export function saldoFinal(): string {
  return aTexto(
    MOVIMIENTOS.reduce(
      (acc, m) => acc.plus(dinero(m.monto)),
      dinero(SALDO_ANTERIOR),
    ),
    2,
  );
}

/** Total de una factura del juego, con el mismo cálculo que escribe el XML. */
export function totalDeFactura(f: CfdiDemo): string {
  return totalDe(f.conceptos.map((c) => c.importe));
}
