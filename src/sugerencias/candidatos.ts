// src/sugerencias/candidatos.ts
import { createHash } from 'crypto';
import { aTexto, dinero, type Dinero } from '../common/dinero';
import {
  candidatosAmbiguos,
  compatibles,
  etiquetaCfdi,
  type CfdiAbierto,
  type MovimientoAbierto,
  type ParExistente,
  type ReglaAmbigua,
} from '../conciliacion/evaluar-par';
import type { EntradaSugerencia } from './proveedor-sugerencia';

/**
 * CU-17. Arma lo que se le pregunta al modelo: el conjunto de candidatos, el
 * payload mínimo y la huella de la entrada. Todo puro: sin base de datos, sin
 * Nest y sin red. Los montos viajan como texto y se comparan con decimal.js.
 */

/**
 * Sube cuando cambia el texto o la forma de la pregunta: entra en la huella,
 * así que un prompt nuevo vuelve a preguntar lo que ya estaba contestado.
 */
export const PROMPT_VERSION = 'v1';

export interface MovimientoSugerible extends MovimientoAbierto {
  descripcion: string;
  /** La regla por la que el motor lo dejó sin propuesta. */
  regla: ReglaAmbigua;
  /** El motivo guardado con esa regla: sirve para detectar un veredicto nuevo. */
  motivo: string;
}

export interface CfdiSugerible extends CfdiAbierto {
  receptor: string | null;
}

export interface CandidatoSugerible {
  etiqueta: string;
  cfdi: CfdiSugerible;
}

/** Una pregunta lista para el proveedor, con lo que el servidor necesita para validarla. */
export interface SolicitudSugerencia {
  movimiento: MovimientoSugerible;
  /** Orden estable: C1..CN. La etiqueta solo se traduce a CFDI aquí, en el servidor. */
  candidatos: CandidatoSugerible[];
  /** Es lo único que sale a la red. */
  entrada: EntradaSugerencia;
  inputHash: string;
}

export type MotivoOmision = 'sin_candidatos' | 'demasiados_candidatos';

export type ConstruccionSolicitud =
  | { tipo: 'solicitud'; solicitud: SolicitudSugerencia }
  | { tipo: 'omitida'; motivo: MotivoOmision };

export interface ParametrosSolicitud {
  movimiento: MovimientoSugerible;
  cfdis: readonly CfdiSugerible[];
  existentes: readonly ParExistente[];
  tolerancia: Dinero;
  modelo: string;
  maxCandidatos: number;
}

/** Orden total y estable, independiente del que devuelva la base. */
function comparar(a: CfdiSugerible, b: CfdiSugerible): number {
  const texto = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  return (
    texto(etiquetaCfdi(a), etiquetaCfdi(b)) ||
    dinero(a.total).comparedTo(dinero(b.total)) ||
    texto(a.fechaEmision, b.fechaEmision) ||
    texto(a.receptor ?? '', b.receptor ?? '') ||
    texto(a.id, b.id)
  );
}

const montoCanonico = (monto: string) => aTexto(dinero(monto), 4);

/**
 * Candidatos de un movimiento: los del motor (`candidatosAmbiguos`) menos lo
 * que ya tiene una conciliación vigente y lo que no es compatible en moneda y
 * fecha. Vacío, o más de `maxCandidatos`, no se pregunta: truncar podría
 * esconder el CFDI correcto, y un falso positivo es peor que no sugerir.
 */
export function construirSolicitud(
  p: ParametrosSolicitud,
): ConstruccionSolicitud {
  const { movimiento: mov } = p;
  const ocupados = new Set(
    p.existentes.filter((e) => !e.rechazada).map((e) => e.cfdiId),
  );
  const elegibles = (
    candidatosAmbiguos(
      mov,
      mov.regla,
      p.cfdis,
      p.tolerancia,
      p.existentes,
    ) as CfdiSugerible[]
  )
    .filter((c) => !ocupados.has(c.id) && compatibles(mov, c))
    .sort(comparar);

  if (elegibles.length === 0)
    return { tipo: 'omitida', motivo: 'sin_candidatos' };
  if (elegibles.length > p.maxCandidatos) {
    return { tipo: 'omitida', motivo: 'demasiados_candidatos' };
  }

  const candidatos = elegibles.map((cfdi, i) => ({
    etiqueta: `C${i + 1}`,
    cfdi,
  }));
  // Se arma campo por campo: lo que no se nombra aquí (RFC, UUID, XML, ids)
  // no puede salir aunque el objeto de origen lo traiga.
  const movimiento = {
    fecha: mov.fecha,
    monto: montoCanonico(mov.monto),
    moneda: mov.moneda,
    descripcion: mov.descripcion,
    referencia: mov.referencia,
  };
  const visibles = candidatos.map(({ etiqueta, cfdi }) => ({
    etiqueta,
    serieFolio: etiquetaCfdi(cfdi),
    total: montoCanonico(cfdi.total),
    fecha: cfdi.fechaEmision,
    receptor: cfdi.receptor ?? '',
  }));

  return {
    tipo: 'solicitud',
    solicitud: {
      movimiento: mov,
      candidatos,
      entrada: { movimiento, candidatos: visibles },
      inputHash: huellaDeEntrada({
        modelo: p.modelo,
        regla: mov.regla,
        movimiento,
        candidatos: visibles,
      }),
    },
  };
}

/**
 * sha256 (hex, 64) del JSON canónico de lo que se pregunta: versión del
 * prompt, modelo, regla, movimiento y candidatos ya ordenados. No lleva ids ni
 * etiquetas (salen del orden), así que cambia si cambia la pregunta y no
 * depende del orden en que la base devolvió los CFDI.
 */
export function huellaDeEntrada(datos: {
  modelo: string;
  regla: ReglaAmbigua;
  movimiento: EntradaSugerencia['movimiento'];
  candidatos: EntradaSugerencia['candidatos'];
}): string {
  const canonico = JSON.stringify({
    v: PROMPT_VERSION,
    modelo: datos.modelo,
    regla: datos.regla,
    movimiento: {
      fecha: datos.movimiento.fecha,
      monto: datos.movimiento.monto,
      moneda: datos.movimiento.moneda,
      descripcion: datos.movimiento.descripcion,
      referencia: datos.movimiento.referencia,
    },
    candidatos: datos.candidatos.map((c) => ({
      serieFolio: c.serieFolio,
      total: c.total,
      fecha: c.fecha,
      receptor: c.receptor,
    })),
  });
  return createHash('sha256').update(canonico).digest('hex');
}
