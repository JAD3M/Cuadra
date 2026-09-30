import { aTexto, dinero } from '../../src/common/dinero';
import { totalDe } from './formatos';
import { crearPrng, type Prng, SEMILLA_DEMO } from './prng';

/**
 * CU-18. La tabla de escenarios: única fuente de verdad de la demo. De aquí
 * salen los archivos (generar.ts) y lo que se espera que el motor haga con
 * ellos (esperado). Nada de lo esperado está escrito a mano como conteo: cada
 * movimiento declara su salida por fase y los totales se derivan sumándolas.
 * Si el motor no produce esa salida, se corrige el dato, nunca el motor.
 *
 * Fechas fijas (agosto-septiembre de 2026), nunca relativas a hoy. RFC: los
 * dos del seed más receptores inventados; todo nombre lleva "(sintético)".
 */

export type Empresa = 'fdb' | 'tcu';

export interface ClienteDemo {
  rfc: string;
  nombre: string;
  /** Cómo aparece el cliente en la descripción bancaria. */
  alias: string;
}

export interface CfdiDemo {
  empresa: Empresa;
  serie: string;
  folio: string;
  /** AAAA-MM-DD */
  fecha: string;
  hora: string;
  receptor: ClienteDemo;
  conceptos: { descripcion: string; importe: string }[];
  moneda: 'MXN' | 'USD';
  tipoCambio?: string;
  metodoPago: 'PUE' | 'PPD';
}

export interface MovimientoDemo {
  empresa: Empresa;
  archivo: 1 | 2 | 'tcu';
  /** AAAA-MM-DD */
  fecha: string;
  descripcion: string;
  referencia: string;
  /** Decimal con signo: positivo abono, negativo cargo. */
  monto: string;
}

/** Qué se espera de un movimiento en una fase. 'fuera': aún no cargado o nunca evaluado (cargo). */
export type Salida =
  | { estado: 'sugerencia'; regla: string }
  | { estado: 'sin_match'; regla: string }
  | { estado: 'conciliado' }
  | { estado: 'fuera' };

export type Fase = 'fase1' | 'fase2' | 'final';

export interface MovimientoEscenario extends MovimientoDemo {
  fase1: Salida;
  fase2: Salida;
  final: Salida;
  /** Qué debe decir el proveedor simulado si el motor lo deja ambiguo. */
  ia?: 'sugiere' | 'ninguno';
  /** Acción humana de la demo sobre este movimiento. */
  accion?: 'confirmar' | 'rechazar';
}

export interface EscenarioDemo {
  id: string;
  cfdis: CfdiDemo[];
  movimientos: MovimientoEscenario[];
}

/** Toda descripción del CSV empieza con uno de estos textos (guarda de privacidad). */
export const PREFIJOS_DESCRIPCION = [
  'SPEI RECIBIDO',
  'TRANSFERENCIA RECIBIDA',
  'TRANSFERENCIA INTERBANCARIA',
  'DEPOSITO',
  'PAGO PARCIAL',
  'PAGO',
  'COMISION',
  'IMPUESTOS',
  'CARGO',
] as const;

const SUG_EXACTA = 'referencia_monto_exacto';
const SUG_DIFERENTE = 'referencia_monto_diferente';
const SUG_UNICO = 'monto_unico';
const SUG_IA = 'llm_sugerencia';

const sug = (regla: string): Salida => ({ estado: 'sugerencia', regla });
const sin = (regla: string): Salida => ({ estado: 'sin_match', regla });
const CONCILIADO: Salida = { estado: 'conciliado' };
const FUERA: Salida = { estado: 'fuera' };

const PUBLICO: ClienteDemo = {
  rfc: 'XAXX010101000',
  nombre: 'Público en general (sintético)',
  alias: 'PUBLICO GENERAL',
};
const cliente = (rfc: string, nombre: string): ClienteDemo => ({
  rfc,
  nombre: `Cliente ${nombre} (sintético)`,
  alias: `CLIENTE ${nombre.toUpperCase()}`,
});
const ALFA = cliente('CAL010101AB1', 'Alfa');
const BETA = cliente('CBE020202BC2', 'Beta');
const GAMA = cliente('CGA030303CD3', 'Gama');
const DELTA = cliente('CDE040404DE4', 'Delta');
const EPSILON = cliente('CEP050505EF5', 'Epsilon');
const ZETA = cliente('CZE060606FG6', 'Zeta');
const ETA = cliente('CET070707GH7', 'Eta');
const CLIENTES: readonly ClienteDemo[] = [
  PUBLICO,
  ALFA,
  BETA,
  GAMA,
  DELTA,
  EPSILON,
  ZETA,
  ETA,
];

/** Rfc de receptor permitidos: lo que la guarda de privacidad acepta además del de las empresas. */
export const RFC_RECEPTORES: readonly string[] = CLIENTES.map((c) => c.rfc);

const DESCRIPCIONES_CONCEPTO = [
  'Material de ferretería',
  'Herramienta menor',
  'Servicio de entrega',
];

const PLANTILLAS_BANCO = [
  'SPEI RECIBIDO',
  'TRANSFERENCIA INTERBANCARIA',
  'DEPOSITO REFERENCIADO',
];

/** AAAA-MM-DD + n días, en calendario UTC (sin reloj: solo aritmética de fechas). */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const HORA = '10:30:00';

function cfdi(
  empresa: Empresa,
  serie: string,
  folio: string,
  fecha: string,
  importes: string[],
  receptor: ClienteDemo,
  extra: Partial<Pick<CfdiDemo, 'moneda' | 'tipoCambio' | 'metodoPago'>> = {},
): CfdiDemo {
  return {
    empresa,
    serie,
    folio,
    fecha,
    hora: HORA,
    receptor,
    conceptos: importes.map((importe, i) => ({
      descripcion: DESCRIPCIONES_CONCEPTO[i % DESCRIPCIONES_CONCEPTO.length],
      importe,
    })),
    moneda: extra.moneda ?? 'MXN',
    tipoCambio: extra.tipoCambio,
    metodoPago: extra.metodoPago ?? 'PUE',
  };
}

function mov(
  empresa: Empresa,
  archivo: MovimientoDemo['archivo'],
  fecha: string,
  monto: string,
  referencia: string,
  descripcion: string,
  salidas: Pick<MovimientoEscenario, Fase> &
    Pick<MovimientoEscenario, 'ia' | 'accion'>,
): MovimientoEscenario {
  return {
    empresa,
    archivo,
    fecha,
    descripcion,
    referencia,
    monto,
    ...salidas,
  };
}

/** Salidas de un movimiento que el motor resuelve igual en las tres fases. */
const igual = (s: Salida) => ({ fase1: s, fase2: s, final: s });

function escenariosExplicitos(): EscenarioDemo[] {
  const f = 'fdb';
  return [
    {
      id: 'S3a',
      cfdis: [cfdi(f, 'A', '1201', '2026-08-20', ['4000.00'], ALFA)],
      movimientos: [
        mov(
          f,
          1,
          '2026-08-28',
          '4340.00',
          'A-1201',
          'PAGO PARCIAL CLIENTE ALFA',
          {
            fase1: sug(SUG_DIFERENTE),
            fase2: sug(SUG_DIFERENTE),
            // Jorge la rechaza: el par sale y el monto queda sin candidato.
            final: sin('sin_candidato_monto'),
            accion: 'rechazar',
          },
        ),
      ],
    },
    {
      id: 'S3b',
      cfdis: [cfdi(f, 'A', '1202', '2026-08-25', ['2500.00'], BETA)],
      movimientos: [
        mov(
          f,
          1,
          '2026-09-02',
          '3050.00',
          '1202',
          'SPEI RECIBIDO CLIENTE BETA',
          igual(sug(SUG_DIFERENTE)),
        ),
      ],
    },
    {
      id: 'T',
      cfdis: [cfdi(f, 'A', '1301', '2026-09-03', ['1000.00'], ZETA)],
      movimientos: [
        // Dentro de 5.00 del CFDI: solo la tolerancia lo vuelve propuesta.
        mov(f, 1, '2026-09-10', '1155.00', '', 'SPEI RECIBIDO CLIENTE ZETA', {
          fase1: sin('sin_candidato_monto'),
          fase2: sug(SUG_UNICO),
          final: sug(SUG_UNICO),
        }),
      ],
    },
    {
      id: 'S4a',
      cfdis: [
        cfdi(f, 'A', '2001', '2026-08-12', ['2000.00'], GAMA),
        cfdi(f, 'B', '2001', '2026-08-12', ['2000.00'], GAMA),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-08-20',
          '2320.00',
          '2001',
          'SPEI RECIBIDO PAGO FACT B-2001 CLIENTE GAMA',
          {
            fase1: sug(SUG_IA),
            fase2: sug(SUG_IA),
            final: sug(SUG_IA),
            ia: 'sugiere',
          },
        ),
      ],
    },
    {
      id: 'S4b',
      cfdis: [
        cfdi(f, 'A', '2002', '2026-08-14', ['1500.00'], GAMA),
        cfdi(f, 'B', '2002', '2026-08-14', ['3000.00'], GAMA),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-08-22',
          '1740.00',
          '2002',
          'TRANSFERENCIA RECIBIDA CLIENTE GAMA',
          {
            fase1: sug(SUG_IA),
            fase2: sug(SUG_IA),
            final: sug(SUG_IA),
            ia: 'sugiere',
          },
        ),
      ],
    },
    {
      id: 'S4c',
      cfdis: [
        cfdi(f, 'A', '2003', '2026-08-18', ['1800.00'], GAMA),
        cfdi(f, 'B', '2003', '2026-08-18', ['1800.00'], GAMA),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-08-27',
          '2088.00',
          '2003',
          'DEPOSITO VENTANILLA CLIENTE GAMA',
          {
            ...igual(sin('referencia_ambigua')),
            ia: 'ninguno',
          },
        ),
      ],
    },
    {
      id: 'S5a',
      cfdis: [
        cfdi(f, 'A', '3001', '2026-08-05', ['3500.00'], DELTA),
        cfdi(f, 'A', '3002', '2026-08-05', ['3500.00'], DELTA),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-08-15',
          '4060.00',
          '',
          'SPEI RECIBIDO PAGO FACT A-3001 CLIENTE DELTA',
          {
            fase1: sug(SUG_IA),
            fase2: sug(SUG_IA),
            final: sug(SUG_IA),
            ia: 'sugiere',
          },
        ),
      ],
    },
    {
      id: 'S5b',
      cfdis: [
        cfdi(f, 'A', '3003', '2026-08-07', ['5000.00'], DELTA),
        cfdi(f, 'A', '3004', '2026-08-07', ['5000.00'], DELTA),
      ],
      movimientos: [
        mov(f, 1, '2026-08-17', '5800.00', '', 'SPEI RECIBIDO CLIENTE DELTA', {
          ...igual(sin('monto_multiples_candidatos')),
          ia: 'ninguno',
        }),
      ],
    },
    {
      id: 'S6',
      cfdis: [cfdi(f, 'A', '3101', '2026-09-01', ['6000.00'], EPSILON)],
      movimientos: [
        mov(
          f,
          1,
          '2026-09-14',
          '6960.00',
          '',
          'SPEI RECIBIDO PAGO FACT A-3101 CLIENTE EPSILON',
          {
            fase1: sug(SUG_IA),
            fase2: sug(SUG_IA),
            final: sug(SUG_IA),
            ia: 'sugiere',
          },
        ),
        // Con un solo candidato y sin cita, el simulado no elige entre iguales.
        mov(
          f,
          1,
          '2026-09-16',
          '6960.00',
          '',
          'DEPOSITO EN EFECTIVO SUC CENTRO',
          {
            fase1: sin('cfdi_multiples_movimientos'),
            fase2: sin('monto_candidato_ocupado'),
            final: sin('monto_candidato_ocupado'),
            ia: 'ninguno',
          },
        ),
      ],
    },
    {
      id: 'S8a',
      cfdis: [cfdi(f, 'A', '4001', '2026-09-10', ['3200.00'], BETA)],
      movimientos: [
        // Pago anterior a la emisión: referencia que no es compatible.
        mov(
          f,
          1,
          '2026-09-08',
          '3712.00',
          'A-4001',
          'SPEI RECIBIDO CLIENTE BETA',
          igual(sin('referencia_cfdi_no_compatible')),
        ),
      ],
    },
    {
      id: 'S8b',
      cfdis: [
        cfdi(f, 'A', '4002', '2026-09-05', ['500.00'], ETA, {
          moneda: 'USD',
          tipoCambio: '17.500000',
        }),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-09-12',
          '10150.00',
          'A-4002',
          'SPEI RECIBIDO CLIENTE ETA',
          igual(sin('referencia_cfdi_no_compatible')),
        ),
      ],
    },
    {
      id: 'S9',
      cfdis: [cfdi(f, 'A', '4101', '2026-09-01', ['2000.00', '2500.00'], ALFA)],
      movimientos: [
        // Doble pago de la misma factura: el motor propone ambos; confirmar uno rechaza al otro.
        mov(
          f,
          1,
          '2026-09-09',
          '5220.00',
          'A-4101',
          'SPEI RECIBIDO CLIENTE ALFA',
          igual(sug(SUG_EXACTA)),
        ),
        mov(
          f,
          1,
          '2026-09-11',
          '5220.00',
          'A4101',
          'TRANSFERENCIA INTERBANCARIA CLIENTE ALFA',
          igual(sug(SUG_EXACTA)),
        ),
      ],
    },
    {
      id: 'S10',
      cfdis: [
        cfdi(f, 'A', '4201', '2026-09-02', ['8000.00'], BETA, {
          metodoPago: 'PPD',
        }),
      ],
      movimientos: [
        mov(
          f,
          1,
          '2026-09-13',
          '9280.00',
          'A-4201',
          'SPEI RECIBIDO CLIENTE BETA',
          igual(sin('sin_candidato_monto')),
        ),
      ],
    },
    {
      id: 'Sin pago',
      cfdis: [
        cfdi(f, 'A', '5001', '2026-09-04', ['7500.00'], ALFA),
        cfdi(f, 'A', '5002', '2026-09-08', ['11000.00'], PUBLICO),
        cfdi(f, 'A', '5003', '2026-09-12', ['2750.00'], ZETA),
        cfdi(f, 'A', '5004', '2026-09-16', ['15000.00'], ETA),
      ],
      movimientos: [],
    },
    {
      id: 'Cargos',
      cfdis: [],
      movimientos: [
        cargo(1, '2026-08-05', '-350.00', 'COMISION MANEJO DE CUENTA'),
        cargo(1, '2026-08-15', '-28450.00', 'PAGO NOMINA QUINCENA'),
        cargo(1, '2026-08-31', '-28500.00', 'PAGO NOMINA QUINCENA'),
        cargo(1, '2026-09-02', '-15230.50', 'PAGO A PROVEEDOR MATERIALES'),
        cargo(1, '2026-09-10', '-12.50', 'COMISION POR TRANSFERENCIA SPEI'),
        cargo(1, '2026-09-14', '-9800.00', 'PAGO RENTA LOCAL'),
        cargo(2, '2026-09-21', '-4120.75', 'IMPUESTOS RETENIDOS ISR'),
        cargo(2, '2026-09-25', '-1875.20', 'CARGO SERVICIO ENERGIA'),
      ],
    },
  ];
}

function cargo(
  archivo: 1 | 2,
  fecha: string,
  monto: string,
  descripcion: string,
): MovimientoEscenario {
  return mov('fdb', archivo, fecha, monto, '', descripcion, igual(FUERA));
}

function escenarioTcu(): EscenarioDemo {
  const t = 'tcu';
  const p = (
    fecha: string,
    monto: string,
    ref: string,
    desc: string,
    s: Salida,
  ) => mov(t, 'tcu', fecha, monto, ref, desc, igual(s));
  return {
    id: 'TCU',
    cfdis: [
      cfdi(t, 'T', '501', '2026-09-01', ['12000.00'], ALFA),
      cfdi(t, 'T', '502', '2026-09-03', ['9000.00'], BETA),
      cfdi(t, 'T', '503', '2026-09-05', ['4400.00'], GAMA),
      cfdi(t, 'T', '504', '2026-09-08', ['2200.00'], DELTA),
    ],
    movimientos: [
      p(
        '2026-09-12',
        '13920.00',
        'T-501',
        'SPEI RECIBIDO CLIENTE ALFA',
        sug(SUG_EXACTA),
      ),
      p(
        '2026-09-14',
        '10440.00',
        'T502',
        'SPEI RECIBIDO CLIENTE BETA',
        sug(SUG_EXACTA),
      ),
      p(
        '2026-09-15',
        '5104.00',
        '',
        'TRANSFERENCIA RECIBIDA CLIENTE GAMA',
        sug(SUG_UNICO),
      ),
      // Mismo monto que A-5001 de FDB: no debe cruzar entre empresas.
      p(
        '2026-09-18',
        '8700.00',
        '',
        'DEPOSITO EN EFECTIVO SUC NORTE',
        sin('sin_candidato_monto'),
      ),
      p('2026-09-19', '-3250.00', '', 'PAGO SERVICIO DE MANTENIMIENTO', FUERA),
    ],
  };
}

const MARGEN = dinero('25.00');

/** ¿Este monto está a menos de 25.00 de alguno de los ya usados? */
function choca(monto: string, usados: readonly string[]): boolean {
  return usados.some((u) => dinero(monto).minus(dinero(u)).abs().lt(MARGEN));
}

/** Importes en múltiplos de 0.25: el IVA al 16% sale exacto al centavo. */
function cuartos(q: number): string {
  return aTexto(dinero(String(q)).div(4), 2);
}

function repartir(q: number, prng: Prng): string[] {
  if (q < 2 || prng.entero(1, 2) === 1) return [cuartos(q)];
  const primero = prng.entero(1, q - 1);
  return [cuartos(primero), cuartos(q - primero)];
}

/** S1, S2 y S7: relleno con PRNG; cada total y monto queda a 25.00 o más de todos los demás. */
function escenariosMasivos(
  explicitos: readonly EscenarioDemo[],
  prng: Prng,
): EscenarioDemo[] {
  const usados: string[] = explicitos.flatMap((e) => [
    ...e.cfdis.map((c) => totalDe(c.conceptos.map((x) => x.importe))),
    ...e.movimientos.map((m) => m.monto.replace('-', '')),
  ]);

  const nuevoCfdi = (
    serie: string,
    folio: string,
    diaInicial: number,
  ): { cfdi: CfdiDemo; total: string; cliente: ClienteDemo } => {
    let q: number;
    let total: string;
    do {
      q = prng.entero(4800, 192000);
      total = totalDe([cuartos(q)]);
    } while (choca(total, usados));
    usados.push(total);
    const cli = CLIENTES[prng.entero(0, CLIENTES.length - 1)];
    const fecha = sumarDias('2026-08-03', prng.entero(0, diaInicial));
    return {
      cfdi: cfdi('fdb', serie, folio, fecha, repartir(q, prng), cli),
      total,
      cliente: cli,
    };
  };

  const descripcion = (cli: ClienteDemo) =>
    `${PLANTILLAS_BANCO[prng.entero(0, PLANTILLAS_BANCO.length - 1)]} ${cli.alias}`;

  const s1: EscenarioDemo = { id: 'S1', cfdis: [], movimientos: [] };
  const variantes = (folio: string): string[] => [
    `A-${folio}`,
    `A${folio}`,
    folio,
    `A-0${folio}`,
  ];
  for (let i = 0; i < 12; i++) {
    const folio = String(1001 + i);
    const n = nuevoCfdi('A', folio, 44);
    s1.cfdis.push(n.cfdi);
    const fecha = sumarDias(n.cfdi.fecha, prng.entero(1, 10));
    s1.movimientos.push(
      mov(
        'fdb',
        1,
        fecha,
        n.total,
        variantes(folio)[i % 4],
        descripcion(n.cliente),
        {
          fase1: sug(SUG_EXACTA),
          fase2: sug(SUG_EXACTA),
          // La primera la confirma Jorge (Luis, que subió el archivo, no puede).
          final: i === 0 ? CONCILIADO : sug(SUG_EXACTA),
          accion: i === 0 ? 'confirmar' : undefined,
        },
      ),
    );
  }

  const s2: EscenarioDemo = { id: 'S2', cfdis: [], movimientos: [] };
  for (let i = 0; i < 6; i++) {
    const folio = String(1101 + i);
    const n = nuevoCfdi('A', folio, 44);
    s2.cfdis.push(n.cfdi);
    const fecha = sumarDias(n.cfdi.fecha, prng.entero(1, 10));
    // Sin referencia, o con una que no es de ningún CFDI: solo el monto une el par.
    const ref = i < 3 ? '' : `SPEI ${prng.entero(1000000, 9999999)}`;
    s2.movimientos.push(
      mov(
        'fdb',
        1,
        fecha,
        n.total,
        ref,
        descripcion(n.cliente),
        igual(sug(SUG_UNICO)),
      ),
    );
  }

  const s7: EscenarioDemo = { id: 'S7', cfdis: [], movimientos: [] };
  const originantes = [
    'SPEI RECIBIDO ORDENANTE EXTERNO',
    'TRANSFERENCIA RECIBIDA TERCERO',
    'DEPOSITO EN EFECTIVO SUC CENTRO',
  ];
  for (let i = 0; i < 9; i++) {
    const archivo = i < 6 ? 1 : 2;
    let monto: string;
    do {
      monto = aTexto(dinero(String(prng.entero(250000, 4500000))).div(100), 2);
    } while (choca(monto, usados));
    usados.push(monto);
    const fecha =
      archivo === 1
        ? sumarDias('2026-08-05', prng.entero(0, 46))
        : sumarDias('2026-09-21', prng.entero(0, 8));
    const ref = i % 2 === 0 ? '' : `SPEI ${prng.entero(1000000, 9999999)}`;
    s7.movimientos.push(
      mov('fdb', archivo, fecha, monto, ref, originantes[i % 3], {
        fase1: archivo === 1 ? sin('sin_candidato_monto') : FUERA,
        fase2: sin('sin_candidato_monto'),
        final: sin('sin_candidato_monto'),
      }),
    );
  }
  return [s1, s2, s7];
}

/** Construye la tabla completa. Pura: cada llamada rehace el PRNG con la misma semilla. */
export function construirEscenarios(): EscenarioDemo[] {
  const explicitos = escenariosExplicitos();
  const masivos = escenariosMasivos(explicitos, crearPrng(SEMILLA_DEMO));
  const [s1, s2, s7] = masivos;
  const cargos = explicitos.pop() as EscenarioDemo;
  return [s1, s2, ...explicitos, s7, cargos, escenarioTcu()];
}

export interface Esperado {
  sugerencia: number;
  sin_match: number;
  conciliado: number;
  /** Conteo por regla (de sugerencia o de sin_match). */
  porRegla: Record<string, number>;
  /** Propuestas que vienen del proveedor simulado. */
  ia: number;
}

/** Suma las salidas declaradas por movimiento: los conteos nunca se escriben a mano. */
export function esperado(
  fase: Fase,
  empresa: Empresa,
  escenarios: readonly EscenarioDemo[] = construirEscenarios(),
): Esperado {
  const r: Esperado = {
    sugerencia: 0,
    sin_match: 0,
    conciliado: 0,
    porRegla: {},
    ia: 0,
  };
  for (const e of escenarios) {
    for (const m of e.movimientos) {
      if (m.empresa !== empresa) continue;
      const s = m[fase];
      if (s.estado === 'fuera') continue;
      r[s.estado]++;
      if (s.estado !== 'conciliado') {
        r.porRegla[s.regla] = (r.porRegla[s.regla] ?? 0) + 1;
        if (s.regla === SUG_IA) r.ia++;
      }
    }
  }
  return r;
}
