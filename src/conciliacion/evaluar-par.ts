// src/conciliacion/evaluar-par.ts
import { aTexto, CERO, dinero, type Dinero } from '../common/dinero';
import type { ReglaSinMatch } from '../common/entities/tipos';
import { clavesDeCfdi, esReferenciaUsable } from './referencia-normalizer';

/**
 * Motor de reglas de CU-11. Funciones puras: sin base de datos ni Nest.
 * Solo produce propuestas; confirmar es cosa de una persona (CU-15).
 */

export const REGLA_REFERENCIA_MONTO_EXACTO = 'referencia_monto_exacto';
export const REGLA_REFERENCIA_MONTO_DIFERENTE = 'referencia_monto_diferente';
export const REGLA_MONTO_UNICO = 'monto_unico';

export const SCORE_REFERENCIA_MONTO_EXACTO = 1.0;
export const SCORE_REFERENCIA_MONTO_DIFERENTE = 0.5;
export const SCORE_MONTO_UNICO = 0.4;

export type ReglaConciliacion =
  | typeof REGLA_REFERENCIA_MONTO_EXACTO
  | typeof REGLA_REFERENCIA_MONTO_DIFERENTE
  | typeof REGLA_MONTO_UNICO;

/** Fechas 'YYYY-MM-DD' y montos como texto: nunca `number`. */
export interface MovimientoAbierto {
  id: string;
  fecha: string;
  monto: string;
  moneda: string;
  /** Referencia tal como vino en el estado de cuenta, para el motivo. */
  referencia: string | null;
  referenciaNorm: string | null;
}

export interface CfdiAbierto {
  id: string;
  serie: string | null;
  folio: string | null;
  fechaEmision: string;
  total: string;
  moneda: string;
}

/** Una conciliación que ya existe; las rechazadas no se vuelven a proponer. */
export interface ParExistente {
  cfdiId: string;
  movimientoId: string;
  rechazada: boolean;
}

/** Un movimiento abierto sin propuesta, con el porqué en español (CU-13). */
export interface SinMatch {
  movimientoId: string;
  regla: ReglaSinMatch;
  motivo: string;
}

export interface Propuesta {
  cfdiId: string;
  movimientoId: string;
  regla: ReglaConciliacion;
  score: number;
  /** monto - total, con signo y 4 decimales. */
  diferenciaMonto: string;
  motivo: string;
}

/** Moneda igual y el movimiento no es anterior a la emisión (solo fecha). */
function compatibles(mov: MovimientoAbierto, cfdi: CfdiAbierto): boolean {
  return mov.moneda === cfdi.moneda && mov.fecha >= cfdi.fechaEmision;
}

/**
 * La tolerancia configurada es en MXN absolutos (CU-12): en otra moneda no
 * significa nada, y ahí el monto sigue siendo exacto.
 */
function toleranciaEn(moneda: string, tolerancia: Dinero): Dinero {
  return moneda === 'MXN' ? tolerancia : CERO;
}

function diferencia(mov: MovimientoAbierto, cfdi: CfdiAbierto): Dinero {
  return dinero(mov.monto).minus(dinero(cfdi.total));
}

function etiquetaCfdi(cfdi: CfdiAbierto): string {
  const folio = cfdi.folio ?? '';
  return cfdi.serie ? `${cfdi.serie}-${folio}` : folio;
}

function motivoDe(
  regla: ReglaConciliacion,
  mov: MovimientoAbierto,
  cfdi: CfdiAbierto,
  dif: Dinero,
): string {
  const montos = `monto del movimiento ${mov.monto} y total del CFDI ${cfdi.total} ${cfdi.moneda}`;
  const factura = etiquetaCfdi(cfdi);
  if (regla === REGLA_MONTO_UNICO) {
    return (
      `Sin referencia utilizable; el monto fue la única coincidencia ` +
      `con el CFDI ${factura} (${montos}).`
    );
  }
  const base =
    `La referencia "${mov.referencia ?? ''}" del movimiento ` +
    `coincide con el CFDI ${factura} (${montos})`;
  if (regla === REGLA_REFERENCIA_MONTO_EXACTO) {
    return dif.isZero()
      ? `${base}.`
      : `${base}, con una diferencia de ${aTexto(dif, 2)} dentro de la tolerancia.`;
  }
  return (
    `${base}, pero los montos difieren en ${aTexto(dif, 2)}. ` +
    `Es una sugerencia que requiere revisión.`
  );
}

interface ContextoSinMatch {
  mov: MovimientoAbierto;
  cfdi?: CfdiAbierto;
  cantidad?: number;
}

/** Texto en español de un movimiento sin propuesta; nunca dice que un cruce sea correcto o erróneo. */
function motivoSinMatch(regla: ReglaSinMatch, ctx: ContextoSinMatch): string {
  const { mov, cfdi, cantidad } = ctx;
  const ref = `La referencia "${mov.referencia ?? ''}"`;
  const factura = cfdi ? etiquetaCfdi(cfdi) : '';
  switch (regla) {
    case 'referencia_ambigua':
      return (
        `${ref} coincide con ${cantidad} CFDI abiertos; no se propone ninguno ` +
        `ni se intenta por monto para evitar un cruce equivocado.`
      );
    case 'referencia_cfdi_ocupado':
      return `${ref} coincide con el CFDI ${factura}, que ya está vinculado a otro movimiento.`;
    case 'referencia_cfdi_no_compatible': {
      const causa =
        mov.moneda !== cfdi!.moneda
          ? `la moneda del movimiento (${mov.moneda}) no es la del CFDI (${cfdi!.moneda})`
          : `la fecha del movimiento (${mov.fecha}) es anterior a la emisión del CFDI (${cfdi!.fechaEmision})`;
      return `${ref} coincide con el CFDI ${factura}, pero ${causa}.`;
    }
    case 'sin_candidato_monto':
      return (
        `Ningún CFDI abierto coincide por referencia ni por monto ` +
        `(monto del movimiento ${mov.monto}).`
      );
    case 'monto_multiples_candidatos':
      return (
        `${cantidad} CFDI abiertos coinciden con el monto ${mov.monto} y no hay ` +
        `referencia que desempate; no hay una coincidencia única.`
      );
    case 'monto_candidato_ocupado':
      return (
        `El CFDI ${factura}, único que coincide con el monto ${mov.monto}, ` +
        `ya está vinculado a otro movimiento.`
      );
    case 'cfdi_multiples_movimientos':
      return (
        `El CFDI ${factura} coincide con el monto ${mov.monto}, pero otros ` +
        `movimientos abiertos comparten ese monto; no se propone para evitar un cruce equivocado.`
      );
  }
}

/**
 * Evalúa un par. `porReferencia` dice si el CFDI se eligió por referencia
 * (la diferencia de monto solo rebaja el score) o solo por monto (fuera de
 * tolerancia no hay propuesta). La diferencia real siempre se conserva.
 */
export function evaluarPar(
  mov: MovimientoAbierto,
  cfdi: CfdiAbierto,
  tolerancia: Dinero,
  opciones: { porReferencia: boolean },
): Propuesta | null {
  if (!compatibles(mov, cfdi)) return null;
  const dif = diferencia(mov, cfdi);
  const dentro = dif.abs().lte(toleranciaEn(cfdi.moneda, tolerancia));

  let regla: ReglaConciliacion;
  let score: number;
  if (!opciones.porReferencia) {
    if (!dentro) return null;
    regla = REGLA_MONTO_UNICO;
    score = SCORE_MONTO_UNICO;
  } else if (dentro) {
    regla = REGLA_REFERENCIA_MONTO_EXACTO;
    score = SCORE_REFERENCIA_MONTO_EXACTO;
  } else {
    regla = REGLA_REFERENCIA_MONTO_DIFERENTE;
    score = SCORE_REFERENCIA_MONTO_DIFERENTE;
  }
  return {
    cfdiId: cfdi.id,
    movimientoId: mov.id,
    regla,
    score,
    diferenciaMonto: aTexto(dif, 4),
    motivo: motivoDe(regla, mov, cfdi, dif),
  };
}

export interface EvaluacionConMotivos {
  propuestas: Propuesta[];
  sinMatch: SinMatch[];
}

/**
 * Elige propuestas para el conjunto abierto de una empresa y explica cada
 * movimiento que se quedó sin ninguna (CU-13).
 *
 * - Referencia utilizable que empata con un solo CFDI: se evalúa ese par. Si
 *   empata con dos o más, o el único falla moneda/fecha, no hay fila ni
 *   respaldo por monto (un falso positivo es peor que no conciliar).
 * - Sin referencia utilizable, o sin empate: monto único, y solo si movimiento
 *   y CFDI son el único candidato el uno del otro.
 * - Lo que ya tiene una conciliación vigente no recibe otra ni razón: sigue
 *   contando como candidato; un par rechazado sale del conjunto.
 *
 * Cada movimiento abierto queda en exactamente uno de: ocupado, propuesta o
 * sinMatch.
 */
export function evaluarConMotivos(
  movimientos: readonly MovimientoAbierto[],
  cfdis: readonly CfdiAbierto[],
  tolerancia: Dinero,
  existentes: readonly ParExistente[],
): EvaluacionConMotivos {
  const rechazados = new Set(
    existentes
      .filter((e) => e.rechazada)
      .map((e) => `${e.movimientoId}|${e.cfdiId}`),
  );
  const movsOcupados = new Set(
    existentes.filter((e) => !e.rechazada).map((e) => e.movimientoId),
  );
  const cfdisOcupados = new Set(
    existentes.filter((e) => !e.rechazada).map((e) => e.cfdiId),
  );
  const permitido = (m: MovimientoAbierto, c: CfdiAbierto): boolean =>
    !rechazados.has(`${m.id}|${c.id}`);
  const porMonto = (m: MovimientoAbierto, c: CfdiAbierto): boolean =>
    permitido(m, c) &&
    compatibles(m, c) &&
    diferencia(m, c).abs().lte(toleranciaEn(c.moneda, tolerancia));

  const llaves = new Map(cfdis.map((c) => [c.id, new Set(clavesDeCfdi(c))]));
  const propuestas: Propuesta[] = [];
  const sinMatch: SinMatch[] = [];
  const sin = (
    m: MovimientoAbierto,
    regla: ReglaSinMatch,
    ctx: Omit<ContextoSinMatch, 'mov'> = {},
  ): void => {
    sinMatch.push({
      movimientoId: m.id,
      regla,
      motivo: motivoSinMatch(regla, { mov: m, ...ctx }),
    });
  };

  for (const m of movimientos) {
    if (movsOcupados.has(m.id)) continue;

    if (esReferenciaUsable(m.referenciaNorm)) {
      const porReferencia = cfdis.filter(
        (c) => permitido(m, c) && llaves.get(c.id)!.has(m.referenciaNorm!),
      );
      if (porReferencia.length > 0) {
        const [unico] = porReferencia;
        if (porReferencia.length > 1) {
          sin(m, 'referencia_ambigua', { cantidad: porReferencia.length });
        } else if (cfdisOcupados.has(unico.id)) {
          sin(m, 'referencia_cfdi_ocupado', { cfdi: unico });
        } else {
          const p = evaluarPar(m, unico, tolerancia, { porReferencia: true });
          if (p) propuestas.push(p);
          else sin(m, 'referencia_cfdi_no_compatible', { cfdi: unico });
        }
        continue;
      }
    }

    const candidatos = cfdis.filter((c) => porMonto(m, c));
    if (candidatos.length === 0) {
      sin(m, 'sin_candidato_monto');
      continue;
    }
    if (candidatos.length > 1) {
      sin(m, 'monto_multiples_candidatos', { cantidad: candidatos.length });
      continue;
    }
    const [c] = candidatos;
    if (cfdisOcupados.has(c.id)) {
      sin(m, 'monto_candidato_ocupado', { cfdi: c });
      continue;
    }
    const movimientosDelCfdi = movimientos.filter((o) => porMonto(o, c));
    if (movimientosDelCfdi.length !== 1) {
      sin(m, 'cfdi_multiples_movimientos', { cfdi: c });
      continue;
    }
    const p = evaluarPar(m, c, tolerancia, { porReferencia: false });
    if (p) propuestas.push(p);
    else sin(m, 'sin_candidato_monto');
  }
  return { propuestas, sinMatch };
}

/** Solo las propuestas de `evaluarConMotivos` (contrato de CU-11). */
export function seleccionarPropuestas(
  movimientos: readonly MovimientoAbierto[],
  cfdis: readonly CfdiAbierto[],
  tolerancia: Dinero,
  existentes: readonly ParExistente[],
): Propuesta[] {
  return evaluarConMotivos(movimientos, cfdis, tolerancia, existentes)
    .propuestas;
}
