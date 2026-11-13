import { aTexto, dinero } from '../common/dinero';

/**
 * Historia 8.3. Arma las líneas de texto de un estado de cuenta SINTÉTICO de
 * cada banco con PDF, cada una con el layout que lee su lector. Es una sola
 * fuente para las pruebas de contrato y de punta a punta: los tres bancos
 * cuentan el mismo mes. No hay PDF real de ningún banco: los layouts de
 * Banorte y Santander son supuestos y el de BBVA es el acordado en 3.2.
 */

export type BancoDePrueba = 'bbva' | 'banorte' | 'santander';
export const BANCOS_DE_PRUEBA: readonly BancoDePrueba[] = [
  'bbva',
  'banorte',
  'santander',
];

export interface MovimientoDePrueba {
  /** AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  /** Vacío si no lleva referencia. */
  referencia: string;
  /** Con signo: negativo es cargo. */
  monto: string;
}

export interface EstadoDeCuentaDePrueba {
  /** AAAA-MM-DD. */
  periodoInicio: string;
  periodoFin: string;
  saldoInicial: string;
  /** Por defecto, el que resulta de sumar los movimientos. */
  saldoFinal?: string;
  movimientos: readonly MovimientoDePrueba[];
  moneda?: string;
}

const MESES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

function conMiles(importe: string): string {
  const negativo = importe.startsWith('-');
  const [entero, decimales] = importe.replace('-', '').split('.');
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}${conComas}.${decimales}`;
}

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split('-');
  return { anio, mes, dia, abreviatura: MESES[Number(mes) - 1] };
}

const ddmmaaaa = (fecha: string, separador: string) => {
  const { anio, mes, dia } = partes(fecha);
  return [dia, mes, anio].join(separador);
};

/** Cada movimiento con su saldo corrido ya calculado. */
function conSaldos(estado: EstadoDeCuentaDePrueba) {
  let saldo = dinero(estado.saldoInicial);
  return estado.movimientos.map((m) => {
    saldo = saldo.plus(dinero(m.monto));
    return { ...m, saldo: aTexto(saldo, 2) };
  });
}

export function saldoFinalDe(estado: EstadoDeCuentaDePrueba): string {
  return (
    estado.saldoFinal ?? conSaldos(estado).at(-1)?.saldo ?? estado.saldoInicial
  );
}

export function lineasDeEstadoCuenta(
  banco: BancoDePrueba,
  estado: EstadoDeCuentaDePrueba,
): string[] {
  const moneda = estado.moneda ?? 'MXN';
  const inicial = conMiles(estado.saldoInicial);
  const final = conMiles(saldoFinalDe(estado));
  const movimientos = conSaldos(estado);
  const periodo = `${ddmmaaaa(estado.periodoInicio, '/')}`;
  const periodoFin = ddmmaaaa(estado.periodoFin, '/');
  const sintetico = 'DOCUMENTO SINTETICO - SIN DATOS REALES';

  switch (banco) {
    case 'bbva':
      return [
        sintetico,
        'BBVA ESTADO DE CUENTA',
        `Periodo DEL ${periodo} AL ${periodoFin}`,
        `Moneda ${moneda}`,
        `Saldo Anterior ${inicial}`,
        'FECHA OPER LIQ DESCRIPCION IMPORTE SALDO',
        ...movimientos.map((m) => {
          const { dia, abreviatura } = partes(m.fecha);
          const corta = `${dia}/${abreviatura}`;
          const ref = m.referencia === '' ? '' : ` Ref. ${m.referencia}`;
          return `${corta} ${corta} ${m.descripcion}${ref} ${conMiles(m.monto)} ${conMiles(m.saldo)}`;
        }),
        `Saldo Final ${final}`,
      ];
    case 'banorte':
      return [
        sintetico,
        'BANORTE',
        'ESTADO DE CUENTA EMPRESARIAL',
        `Periodo: ${periodo} al ${periodoFin}`,
        `Moneda: ${moneda}`,
        `Saldo inicial: ${inicial}`,
        `Saldo final: ${final}`,
        'FECHA DESCRIPCION IMPORTE SALDO',
        ...movimientos.map((m) => {
          const { dia, anio, abreviatura } = partes(m.fecha);
          const ref = m.referencia === '' ? '' : ` REF ${m.referencia}`;
          return `${dia}-${abreviatura}-${anio} ${m.descripcion}${ref} ${conMiles(m.monto)} ${conMiles(m.saldo)}`;
        }),
      ];
    case 'santander':
      return [
        sintetico,
        'BANCO SANTANDER',
        'CUENTA EMPRESARIAL',
        `Periodo: ${periodo} - ${periodoFin}`,
        `Divisa: ${moneda}`,
        `Saldo inicial del periodo: ${inicial}`,
        `Saldo final del periodo: ${final}`,
        'FECHA CONCEPTO IMPORTE SALDO',
        ...movimientos.map((m) => {
          const ref = m.referencia === '' ? '' : ` Ref: ${m.referencia}`;
          return `${ddmmaaaa(m.fecha, '/')} ${m.descripcion}${ref} ${conMiles(m.monto)} ${conMiles(m.saldo)}`;
        }),
      ];
  }
}

/** Un mes de ejemplo pequeño y limpio, igual para los tres bancos. */
export const MES_DE_PRUEBA: EstadoDeCuentaDePrueba = {
  periodoInicio: '2026-09-01',
  periodoFin: '2026-09-30',
  saldoInicial: '10000.00',
  movimientos: [
    {
      fecha: '2026-09-05',
      descripcion: 'PAGO PROVEEDOR',
      referencia: '8841',
      monto: '-2000.00',
    },
    {
      fecha: '2026-09-12',
      descripcion: 'DEPOSITO CLIENTE',
      referencia: '',
      monto: '3250.50',
    },
    {
      fecha: '2026-09-20',
      descripcion: 'COMISION MANEJO DE CUENTA',
      referencia: '',
      monto: '-250.00',
    },
  ],
};
