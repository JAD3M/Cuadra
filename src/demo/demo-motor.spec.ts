import { dinero } from '../common/dinero';
import {
  type CfdiAbierto,
  evaluarConMotivos,
  type MovimientoAbierto,
  type ParExistente,
} from '../conciliacion/evaluar-par';
import { normalizarReferencia } from '../conciliacion/referencia-normalizer';
import { leerCfdi } from '../cfdi/lector-cfdi';
import { REGLA_LLM_SUGERENCIA } from '../common/entities/tipos';
import {
  construirSolicitud,
  type MovimientoSugerible,
} from '../sugerencias/candidatos';
import {
  decidirSimulado,
  ProveedorSimulado,
} from '../sugerencias/proveedor-simulado';
import { REGLAS_ELEGIBLES } from '../sugerencias/sugerencias.service';
import { validarRespuesta } from '../sugerencias/validar-sugerencia';
import {
  construirEscenarios,
  esperado,
  type Empresa,
  type Fase,
  type MovimientoEscenario,
  type Salida,
} from '../../scripts/demo/escenarios';
import { generarDemo } from '../../scripts/demo/generar';
import { RFC_EMPRESA } from '../../scripts/demo/formatos';
import { leerCsvDemo } from './ayudas-demo';

/**
 * CU-18. El motor decide, y esta prueba lo demuestra sin base de datos: corre
 * las funciones puras del motor (evaluarConMotivos) y del flujo de IA
 * (construirSolicitud, ProveedorSimulado, validarRespuesta) sobre los
 * archivos generados y exige, movimiento por movimiento, la salida que declara
 * la tabla de escenarios. Si difiere, se corrige el DATO, nunca el motor.
 */

const ESCENARIOS = construirEscenarios();
const ARCHIVOS = generarDemo();
const PROVEEDOR = new ProveedorSimulado();

interface Mov extends MovimientoAbierto {
  descripcion: string;
  archivo: string;
  esperado: MovimientoEscenario;
}

function cfdisDe(
  empresa: Empresa,
): (CfdiAbierto & { metodoPago: string | null })[] {
  return [...ARCHIVOS.entries()]
    .filter(([ruta]) => ruta.startsWith(`demo/cfdi/${empresa}-`))
    .map(([, xml]) => leerCfdi(xml))
    .filter((c) => c.rfcEmisor === RFC_EMPRESA[empresa])
    .filter((c) => c.estadoInicial === 'abierta' && c.tipoComprobante === 'I')
    .map((c) => ({
      id: c.uuidFiscal,
      serie: c.serie,
      folio: c.folio,
      fechaEmision: c.fechaEmision.slice(0, 10),
      total: c.total,
      moneda: c.moneda,
      metodoPago: c.metodoPago,
    }));
}

function movsDe(empresa: Empresa): Mov[] {
  const declarados = ESCENARIOS.flatMap((e) => e.movimientos).filter(
    (m) => m.empresa === empresa,
  );
  const clave = (a: string, f: string, m: string, d: string, r: string) =>
    [a, f, m, d, r].join('|');
  const porClave = new Map(
    declarados.map((m) => [
      clave(String(m.archivo), m.fecha, m.monto, m.descripcion, m.referencia),
      m,
    ]),
  );
  expect(porClave.size).toBe(declarados.length);
  const archivos = empresa === 'fdb' ? ['1', '2'] : ['tcu'];
  return archivos.flatMap((archivo) =>
    leerCsvDemo(ARCHIVOS.get(`demo/estado-cuenta-${archivo}.csv`)!)
      .map((m, i) => {
        const ref = m.referencia ?? '';
        const esperadoMov = porClave.get(
          clave(archivo, m.fecha, m.monto, m.descripcion, ref),
        );
        if (!esperadoMov)
          throw new Error(`Sin escenario: ${JSON.stringify(m)}`);
        return {
          id: `${archivo}:${i}`,
          fecha: m.fecha,
          monto: m.monto,
          moneda: 'MXN',
          referencia: m.referencia,
          referenciaNorm: normalizarReferencia(m.referencia),
          descripcion: m.descripcion,
          archivo,
          esperado: esperadoMov,
        };
      })
      .filter((m) => dinero(m.monto).gt(0)),
  );
}

interface Par extends ParExistente {
  regla: string;
  confirmada: boolean;
}

/** Simula lo que hace el sistema tras cada carga: conciliar y, después, preguntar a la IA. */
class Simulacion {
  pares: Par[] = [];
  preguntados = new Set<string>();
  sinMatch = new Map<string, string>();
  presentes: Mov[] = [];
  paresIA = 0;

  constructor(
    private readonly cfdis: (CfdiAbierto & { metodoPago: string | null })[],
  ) {}

  private existentes(): ParExistente[] {
    return this.pares;
  }

  private abiertos(): { movs: Mov[]; cfdis: CfdiAbierto[] } {
    const confirmados = this.pares.filter((p) => p.confirmada);
    return {
      movs: this.presentes.filter(
        (m) => !confirmados.some((p) => p.movimientoId === m.id),
      ),
      cfdis: this.cfdis.filter(
        (c) => !confirmados.some((p) => p.cfdiId === c.id),
      ),
    };
  }

  /** Una corrida de conciliar + la de sugerencias, como las dos colas del sistema. */
  correr(nuevos: Mov[], tolerancia: string): void {
    this.presentes.push(...nuevos);
    const { movs, cfdis } = this.abiertos();
    const r = evaluarConMotivos(
      movs,
      cfdis,
      dinero(tolerancia),
      this.existentes(),
    );
    for (const p of r.propuestas) {
      this.pares.push({
        cfdiId: p.cfdiId,
        movimientoId: p.movimientoId,
        regla: p.regla,
        rechazada: false,
        confirmada: false,
      });
    }
    this.sinMatch = new Map(r.sinMatch.map((s) => [s.movimientoId, s.regla]));

    // Como SugerenciasService: todas las solicitudes se arman con lo leído
    // antes de que la primera propuesta exista.
    const motivos = new Map(r.sinMatch.map((s) => [s.movimientoId, s.motivo]));
    const antes = this.existentes().map((e) => ({ ...e }));
    const solicitudes = movs
      .filter((m) => this.sinMatch.has(m.id))
      .filter((m) =>
        (REGLAS_ELEGIBLES as readonly string[]).includes(
          this.sinMatch.get(m.id)!,
        ),
      )
      .map((m) => {
        const movimiento = {
          ...m,
          regla: this.sinMatch.get(m.id),
          motivo: motivos.get(m.id),
        } as MovimientoSugerible;
        return construirSolicitud({
          movimiento,
          cfdis: cfdis.map((c) => ({ ...c, receptor: '' })),
          existentes: antes,
          tolerancia: dinero(tolerancia),
          modelo: PROVEEDOR.modelo,
          maxCandidatos: 10,
        });
      });
    for (const c of solicitudes) {
      if (c.tipo !== 'solicitud') continue;
      const s = c.solicitud;
      if (this.preguntados.has(`${s.movimiento.id}|${s.inputHash}`)) continue;
      this.preguntados.add(`${s.movimiento.id}|${s.inputHash}`);
      const respuesta = decidirSimulado(s.entrada);
      const d = validarRespuesta(respuesta, s);
      if (d.tipo !== 'sugerir') continue;
      this.pares.push({
        cfdiId: d.cfdiId,
        movimientoId: s.movimiento.id,
        regla: REGLA_LLM_SUGERENCIA,
        rechazada: false,
        confirmada: false,
      });
      this.paresIA++;
      expect(d.motivo).toContain('[SIMULADA — no es un modelo real]');
    }
  }

  confirmar(movimientoId: string): void {
    const par = this.pares.find(
      (p) => p.movimientoId === movimientoId && !p.rechazada,
    )!;
    par.confirmada = true;
  }

  rechazar(movimientoId: string): void {
    this.pares.find(
      (p) => p.movimientoId === movimientoId && !p.rechazada,
    )!.rechazada = true;
  }

  salidas(): Map<string, Salida> {
    const salidas = new Map<string, Salida>();
    for (const m of this.presentes) {
      const par = this.pares.find(
        (p) => p.movimientoId === m.id && !p.rechazada,
      );
      if (par?.confirmada) salidas.set(m.id, { estado: 'conciliado' });
      else if (par)
        salidas.set(m.id, { estado: 'sugerencia', regla: par.regla });
      else if (this.sinMatch.has(m.id)) {
        salidas.set(m.id, {
          estado: 'sin_match',
          regla: this.sinMatch.get(m.id)!,
        });
      }
    }
    return salidas;
  }
}

function contar(
  salidas: Map<string, Salida>,
  movs: Mov[],
  fase: Fase,
): ReturnType<typeof esperado> {
  const r = {
    sugerencia: 0,
    sin_match: 0,
    conciliado: 0,
    porRegla: {} as Record<string, number>,
    ia: 0,
  };
  for (const m of movs) {
    const s = salidas.get(m.id);
    expect(s).toBeDefined();
    expect(s).toEqual(m.esperado[fase]);
    if (!s || s.estado === 'fuera') continue;
    r[s.estado]++;
    if (s.estado !== 'conciliado') {
      r.porRegla[s.regla] = (r.porRegla[s.regla] ?? 0) + 1;
      if (s.regla === REGLA_LLM_SUGERENCIA) r.ia++;
    }
  }
  return r;
}

describe('demo: el motor y la IA simulada reproducen lo esperado (CU-18)', () => {
  const cfdis = cfdisDe('fdb');
  const movs = movsDe('fdb');
  const csv1 = movs.filter((m) => m.archivo === '1');
  const csv2 = movs.filter((m) => m.archivo === '2');

  const sim = new Simulacion(cfdis);
  const fotos: Record<Fase, Map<string, Salida>> = {} as never;
  const paresFase1: Par[][] = [];

  beforeAll(() => {
    sim.correr(csv1, '0');
    fotos.fase1 = sim.salidas();
    paresFase1.push(sim.pares.map((p) => ({ ...p })));
    sim.correr(csv2, '5.00');
    fotos.fase2 = sim.salidas();
    const primera = movs.find((m) => m.esperado.accion === 'confirmar')!;
    const rechazada = movs.find((m) => m.esperado.accion === 'rechazar')!;
    sim.confirmar(primera.id);
    sim.rechazar(rechazada.id);
    sim.correr([], '5.00');
    fotos.final = sim.salidas();
  });

  it.each(['fase1', 'fase2', 'final'] as const)(
    '%s: cada movimiento sale como declara la tabla y los conteos se derivan de ella',
    (fase) => {
      const presentes = fase === 'fase1' ? csv1 : [...csv1, ...csv2];
      const obtenido = contar(fotos[fase], presentes, fase);
      const esp = esperado(fase, 'fdb', ESCENARIOS);
      expect(obtenido).toEqual(esp);
    },
  );

  it('anclaje al diseño: 26/13/0, 27/15/0 y 1/25/16 (4 propuestas de IA)', () => {
    const f = (x: Fase) => {
      const e = esperado(x, 'fdb', ESCENARIOS);
      return [e.sugerencia, e.sin_match, e.conciliado];
    };
    expect(f('fase1')).toEqual([26, 13, 0]);
    expect(f('fase2')).toEqual([27, 15, 0]);
    expect(f('final')).toEqual([25, 16, 1]);
    expect(esperado('fase1', 'fdb', ESCENARIOS).ia).toBe(4);
    expect(esperado('fase1', 'fdb', ESCENARIOS).porRegla).toMatchObject({
      referencia_monto_exacto: 14,
      referencia_monto_diferente: 2,
      monto_unico: 6,
      llm_sugerencia: 4,
      sin_candidato_monto: 8,
      referencia_ambigua: 1,
      monto_multiples_candidatos: 1,
      cfdi_multiples_movimientos: 1,
      referencia_cfdi_no_compatible: 2,
    });
    expect(sim.paresIA).toBe(4);
  });

  it('el motor nunca concilia: solo la confirmación humana llega a conciliado', () => {
    for (const fase of ['fase1', 'fase2'] as const) {
      const estados = [...fotos[fase].values()].map((s) => s.estado);
      expect(estados).not.toContain('conciliado');
    }
    expect(
      [...fotos.final.values()].filter((s) => s.estado === 'conciliado'),
    ).toHaveLength(1);
  });

  it('ningún CFDI en USD o PPD entra en una propuesta', () => {
    const excluidos = new Set(
      [...ARCHIVOS.entries()]
        .filter(([ruta]) => ruta.startsWith('demo/cfdi/fdb-'))
        .map(([, xml]) => leerCfdi(xml))
        .filter((c) => c.moneda !== 'MXN' || c.metodoPago === 'PPD')
        .map((c) => c.uuidFiscal),
    );
    expect(excluidos.size).toBe(2);
    for (const par of sim.pares) expect(excluidos.has(par.cfdiId)).toBe(false);
  });

  it('cada propuesta respeta la fecha: movimiento no anterior al CFDI', () => {
    const porId = new Map(cfdis.map((c) => [c.id, c]));
    for (const par of sim.pares) {
      const m = movs.find((x) => x.id === par.movimientoId)!;
      expect(m.fecha >= porId.get(par.cfdiId)!.fechaEmision).toBe(true);
    }
    // La única excepción deliberada: el pago anterior a la emisión (S8a).
    const anteriores = movs.filter(
      (m) =>
        fotos.fase1.get(m.id)?.estado === 'sin_match' &&
        cfdis.some(
          (c) =>
            c.folio === '4001' &&
            m.fecha < c.fechaEmision &&
            m.referenciaNorm === 'A4001',
        ),
    );
    expect(anteriores).toHaveLength(1);
  });

  it('la tolerancia de 5.00 cambia exactamente un resultado', () => {
    const cambian = movs.filter((m) => {
      const a = fotos.fase1.get(m.id);
      const b = fotos.fase2.get(m.id);
      return a && b && JSON.stringify(a) !== JSON.stringify(b);
    });
    // T (sin_match -> monto_unico) y S6 M2 (ocupado por la propuesta de IA de M1).
    expect(cambian.map((m) => m.esperado.fase2)).toEqual(
      expect.arrayContaining([
        { estado: 'sugerencia', regla: 'monto_unico' },
        { estado: 'sin_match', regla: 'monto_candidato_ocupado' },
      ]),
    );
    expect(cambian).toHaveLength(2);
  });

  it('invariante de montos: solo el par de tolerancia queda a 5.00 o menos sin ser exacto', () => {
    const cercanos: string[] = [];
    for (const m of movs) {
      for (const c of cfdis.filter((x) => x.moneda === 'MXN')) {
        const d = dinero(m.monto).minus(dinero(c.total)).abs();
        if (!d.isZero() && d.lte(5)) cercanos.push(`${m.monto}~${c.total}`);
      }
    }
    expect(cercanos).toEqual(['1155.00~1160.00']);
  });

  it('TCU: 3 propuestas, 1 sin coincidencia y 0 conciliados, sin cruzar con FDB', () => {
    const tcu = new Simulacion(cfdisDe('tcu'));
    const movsTcu = movsDe('tcu');
    tcu.correr(movsTcu, '0');
    const obtenido = contar(tcu.salidas(), movsTcu, 'fase1');
    expect(obtenido).toEqual(esperado('fase1', 'tcu', ESCENARIOS));
    expect([
      obtenido.sugerencia,
      obtenido.sin_match,
      obtenido.conciliado,
    ]).toEqual([3, 1, 0]);
    expect(tcu.paresIA).toBe(0);
  });
});
