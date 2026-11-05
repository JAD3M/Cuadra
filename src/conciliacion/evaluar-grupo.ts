// src/conciliacion/evaluar-grupo.ts
import { aTexto, dinero, sumar, type Dinero } from '../common/dinero';
import type { ReglaSinMatch } from '../common/entities/tipos';
import { huellaConjunto } from './huella-conjunto';
import {
  compatibles,
  etiquetaCfdi,
  monedaSoportada,
  motivoSinMatch,
  predicadosDelMotor,
  REGLA_SUMA_GRUPO,
  SCORE_SUMA_GRUPO,
  toleranciaEn,
  type CfdiAbierto,
  type MovimientoAbierto,
  type ParExistente,
  type SinMatch,
} from './evaluar-par';

/**
 * Historia 4.5 (AD-4). Un depósito que cubre varias facturas de la misma
 * contraparte. Funciones puras: sin base de datos ni Nest. Solo produce una
 * propuesta cuando exactamente un subconjunto suma el monto dentro de la
 * tolerancia; ante la duda no propone nada (un falso positivo es peor que no
 * conciliar). Quien llama ya filtró los CFDI: abiertos, en MXN, compatibles y
 * no ocupados.
 */

/** Tamaño máximo de un subconjunto (la búsqueda es exponencial). */
export const MAX_FACTURAS_POR_SUBCONJUNTO = 5;
/** Candidatos máximos por RFC; si se excede, no se busca y el caso lo explica. */
export const MAX_CANDIDATOS_POR_RFC = 20;

export interface PropuestaGrupo {
  tipo: 'propuesta';
  /** Ids de las facturas del grupo, en orden ascendente. */
  cfdiIds: string[];
  /** monto del movimiento - suma del grupo, con signo y 4 decimales. */
  diferenciaMonto: string;
  regla: typeof REGLA_SUMA_GRUPO;
  score: number;
  motivo: string;
}

export interface SinMatchGrupo {
  tipo: 'sin_match';
  regla: Extract<
    ReglaSinMatch,
    'combinaciones_multiples' | 'candidatos_excedidos'
  >;
  motivo: string;
  /** Las facturas en juego, en orden ascendente. */
  cfdiIds: string[];
}

export type ResultadoGrupo = PropuestaGrupo | SinMatchGrupo | null;

const porId = (a: CfdiAbierto, b: CfdiAbierto): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Subconjuntos de tamaño 2..`max` de `items` (ya ordenados), en orden estable. */
function subconjuntos<T>(items: readonly T[], max: number): T[][] {
  const salida: T[][] = [];
  const actual: T[] = [];
  const recorre = (desde: number): void => {
    if (actual.length >= 2) salida.push([...actual]);
    if (actual.length === max) return;
    for (let i = desde; i < items.length; i++) {
      actual.push(items[i]);
      recorre(i + 1);
      actual.pop();
    }
  };
  recorre(0);
  return salida;
}

function agruparPorRfc(cfdis: readonly CfdiAbierto[]): CfdiAbierto[][] {
  const grupos = new Map<string, CfdiAbierto[]>();
  for (const c of cfdis) {
    const rfc = c.rfcReceptor?.trim();
    if (!rfc) continue;
    grupos.set(rfc, [...(grupos.get(rfc) ?? []), c]);
  }
  return [...grupos.keys()].sort().map((rfc) => grupos.get(rfc)!.sort(porId));
}

const idsOrdenados = (cfdis: readonly CfdiAbierto[]): string[] =>
  [...new Set(cfdis.map((c) => c.id))].sort();

function motivoPropuesta(
  mov: MovimientoAbierto,
  grupo: readonly CfdiAbierto[],
  suma: Dinero,
  dif: Dinero,
): string {
  const facturas = grupo.map((c) => `${etiquetaCfdi(c) || c.id}`).join(', ');
  return (
    `El monto del movimiento ${mov.monto} coincide con la suma ${aTexto(suma, 2)} ` +
    `de ${grupo.length} CFDI de la misma contraparte (${facturas}); ` +
    `diferencia del grupo ${aTexto(dif, 2)}, dentro de la tolerancia. ` +
    `Es una sugerencia que requiere revisión.`
  );
}

export function evaluarGrupo(
  mov: MovimientoAbierto,
  cfdis: readonly CfdiAbierto[],
  tolerancia: Dinero,
): ResultadoGrupo {
  const grupos = agruparPorRfc(cfdis);
  const excedidos = grupos.filter((g) => g.length > MAX_CANDIDATOS_POR_RFC);
  if (excedidos.length > 0) {
    return {
      tipo: 'sin_match',
      regla: 'candidatos_excedidos',
      motivo: motivoSinMatch('candidatos_excedidos', { mov }),
      cfdiIds: idsOrdenados(excedidos.flat()),
    };
  }

  const montoMov = dinero(mov.monto);
  const limite = toleranciaEn(mov.moneda, tolerancia);
  const aciertos: { grupo: CfdiAbierto[]; suma: Dinero; dif: Dinero }[] = [];
  for (const g of grupos) {
    for (const sub of subconjuntos(g, MAX_FACTURAS_POR_SUBCONJUNTO)) {
      const suma = sumar(sub.map((c) => dinero(c.total)));
      const dif = montoMov.minus(suma);
      if (dif.abs().lte(limite)) aciertos.push({ grupo: sub, suma, dif });
    }
  }

  if (aciertos.length === 0) return null;
  if (aciertos.length > 1) {
    return {
      tipo: 'sin_match',
      regla: 'combinaciones_multiples',
      motivo: motivoSinMatch('combinaciones_multiples', {
        mov,
        cantidad: aciertos.length,
      }),
      cfdiIds: idsOrdenados(aciertos.flatMap((a) => a.grupo)),
    };
  }
  const [{ grupo, suma, dif }] = aciertos;
  return {
    tipo: 'propuesta',
    cfdiIds: idsOrdenados(grupo),
    diferenciaMonto: aTexto(dif, 4),
    regla: REGLA_SUMA_GRUPO,
    score: SCORE_SUMA_GRUPO,
    motivo: motivoPropuesta(mov, grupo, suma, dif),
  };
}

export interface PropuestaGrupoDeMovimiento extends PropuestaGrupo {
  movimientoId: string;
}

export interface EvaluacionGrupos {
  propuestas: PropuestaGrupoDeMovimiento[];
  /** Solo los casos con motivo de grupo; el resto conserva su motivo anterior. */
  sinMatch: SinMatch[];
}

/**
 * Corre la búsqueda de grupos para los movimientos que las reglas de una sola
 * factura dejaron en `sin_candidato_monto` (el llamador los elige). Candidatos:
 * los mismos que ven esas reglas (MXN, fecha compatible) menos lo ocupado por
 * una decisión vigente o por `ocupadosExtra` (propuestas de esta corrida).
 *
 * - Un grupo cuya huella ya fue rechazada para ese movimiento no se vuelve a
 *   proponer; el subconjunto rechazado SÍ cuenta al decidir la unicidad.
 * - Si dos movimientos proponen grupos que comparten una factura, ninguno se
 *   propone (el orden de entrada no puede decidir quién gana).
 */
export function proponerGrupos(
  movimientos: readonly MovimientoAbierto[],
  cfdis: readonly CfdiAbierto[],
  tolerancia: Dinero,
  existentes: readonly ParExistente[],
  huellasRechazadas: ReadonlyMap<string, ReadonlySet<string>>,
  ocupadosExtra: ReadonlySet<string> = new Set(),
): EvaluacionGrupos {
  const { cfdisOcupados } = predicadosDelMotor(tolerancia, existentes);
  const porId = new Map(cfdis.map((c) => [c.id, c]));
  const candidatos = cfdis.filter(
    (c) => !cfdisOcupados.has(c.id) && !ocupadosExtra.has(c.id),
  );

  const propuestas: PropuestaGrupoDeMovimiento[] = [];
  const sinMatch: SinMatch[] = [];
  for (const m of movimientos) {
    const r = evaluarGrupo(
      m,
      candidatos.filter((c) => monedaSoportada(c) && compatibles(m, c)),
      tolerancia,
    );
    if (!r) continue;
    if (r.tipo === 'sin_match') {
      const facturas = r.cfdiIds
        .map((id) => porId.get(id))
        .map((c) => (c ? etiquetaCfdi(c) || c.id : ''))
        .filter((e) => e !== '')
        .join(', ');
      sinMatch.push({
        movimientoId: m.id,
        regla: r.regla,
        motivo:
          r.regla === 'combinaciones_multiples' && facturas
            ? `${r.motivo} Facturas en juego: ${facturas}.`
            : r.motivo,
      });
    } else if (!huellasRechazadas.get(m.id)?.has(huellaConjunto(r.cfdiIds))) {
      propuestas.push({ ...r, movimientoId: m.id });
    }
  }

  const usos = new Map<string, number>();
  for (const p of propuestas) {
    for (const id of p.cfdiIds) usos.set(id, (usos.get(id) ?? 0) + 1);
  }
  return {
    propuestas: propuestas.filter((p) =>
      p.cfdiIds.every((id) => usos.get(id) === 1),
    ),
    sinMatch,
  };
}
