import type { FilaBandeja, RespuestaCaso } from '@/shared/api/contratos';
import type { PropuestaCaso } from '@/shared/api/contratos';
import { MOTIVO_IA_SIMULADA, idDe } from '@/test/fixturesBandeja';

// Casos de ejemplo del detalle (CU-23) con la forma exacta que responde
// `GET /casos/:movimientoId`. Los comparten las pruebas de contratos, de
// hooks, de pantalla y de flujos. Los montos son siempre cadenas decimales.

const INSTANTE_CONFIRMACION = '2026-09-03T15:04:05.000Z';

/**
 * Propuesta vigente `n` con un CFDI propio. Ids deterministas: la misma `n`
 * da siempre la misma propuesta, y distintas `n` nunca chocan con las ids de
 * la bandeja (que usan `5000 + n` y `7000 + n`).
 */
export function propuestaCaso(
  n: number,
  o: Partial<PropuestaCaso> = {},
): PropuestaCaso {
  return {
    conciliacionId: idDe(5000 + n),
    estado: 'propuesta',
    origen: 'regla',
    score: '0.9000',
    regla: 'referencia_exacta',
    motivo: 'La referencia del movimiento coincide con el folio del CFDI.',
    diferenciaMonto: '0.0000',
    confirmadaAt: null,
    confirmadaPor: null,
    cfdi: {
      id: idDe(7000 + n),
      uuidFiscal: `A1B2C3D4-0000-4000-8000-${String(n).padStart(12, '0')}`,
      serie: 'A',
      folio: String(1000 + n),
      nombreEmisor: 'Ferreteria del Bajio SA de CV',
      rfcReceptor: 'XAXX010101000',
      nombreReceptor: 'Publico en General',
      fechaEmision: '2026-09-01',
      total: '1160.0000',
      moneda: 'MXN',
      metodoPago: 'PUE',
    },
    ...o,
  };
}

/** Un caso por defecto en `sugerencia` con una propuesta; se ajusta por prueba. */
function caso(o: Partial<RespuestaCaso> = {}): RespuestaCaso {
  return {
    movimiento: {
      id: idDe(1),
      fecha: '2026-09-02',
      monto: '1160.0000',
      moneda: 'MXN',
      descripcion: 'SPEI recibido Ferreteria del Bajio',
      referencia: 'F-2001',
    },
    estado: 'sugerencia',
    sinMatch: null,
    toleranciaMonto: '0.5000',
    propuestas: [propuestaCaso(1)],
    ...o,
  };
}

export const casoSugerencia = (o: Partial<RespuestaCaso> = {}) => caso(o);

/** Tres propuestas: score 0.9, 0.7 y nulo, en el orden del servidor. */
export const casoVarias = (o: Partial<RespuestaCaso> = {}) =>
  caso({
    propuestas: [
      propuestaCaso(1),
      propuestaCaso(2, { score: '0.7000', diferenciaMonto: '-0.3000' }),
      propuestaCaso(3, { score: null, diferenciaMonto: '40.0000' }),
    ],
    ...o,
  });

export const casoSinMatch = (o: Partial<RespuestaCaso> = {}) =>
  caso({
    estado: 'sin_match',
    sinMatch: {
      regla: 'monto_multiples_candidatos',
      motivo: 'Hay varios CFDI con el mismo monto.',
    },
    propuestas: [],
    ...o,
  });

export const casoConciliado = (o: Partial<RespuestaCaso> = {}) =>
  caso({
    estado: 'conciliado',
    propuestas: [
      propuestaCaso(1, {
        estado: 'confirmada',
        confirmadaAt: INSTANTE_CONFIRMACION,
        confirmadaPor: { nombre: 'Ana' },
      }),
    ],
    ...o,
  });

/** Propuesta del LLM simulado: el motivo lleva el prefijo completo. */
export const casoLlm = (o: Partial<RespuestaCaso> = {}) =>
  caso({
    propuestas: [
      propuestaCaso(1, {
        origen: 'llm',
        regla: 'llm_sugerencia',
        motivo: MOTIVO_IA_SIMULADA,
        score: '0.5000',
      }),
    ],
    ...o,
  });

/**
 * El caso que corresponde a una fila de la bandeja, para que cada fila de
 * `FILAS_DEMO` sea navegable. Una fila `sugerencia` con `propuestasCount > 1`
 * agrega propuestas con score decreciente tras la mejor.
 */
export function casoDeFila(fila: FilaBandeja): RespuestaCaso {
  const base = caso({
    movimiento: {
      id: fila.movimientoId,
      fecha: fila.fecha,
      monto: fila.monto,
      moneda: fila.moneda,
      descripcion: fila.descripcion,
      referencia: fila.referencia,
    },
  });
  const mejor = fila.mejorPropuesta;
  if (fila.estado === 'sin_match' || mejor === null) {
    return {
      ...base,
      estado: 'sin_match',
      sinMatch: { regla: fila.regla, motivo: fila.motivo },
      propuestas: [],
    };
  }
  const propuestaMejor: PropuestaCaso = {
    ...propuestaCaso(0),
    conciliacionId: mejor.conciliacionId,
    diferenciaMonto: mejor.diferenciaMonto,
    regla: fila.regla,
    motivo: fila.motivo,
    origen: fila.regla === 'llm_sugerencia' ? 'llm' : 'regla',
    cfdi: {
      ...propuestaCaso(0).cfdi,
      ...mejor.cfdi,
      nombreEmisor: 'Ferreteria del Bajio SA de CV',
    },
  };
  if (fila.estado === 'conciliado') {
    return {
      ...base,
      estado: 'conciliado',
      propuestas: [
        {
          ...propuestaMejor,
          estado: 'confirmada',
          confirmadaAt: INSTANTE_CONFIRMACION,
          confirmadaPor: { nombre: 'Ana' },
        },
      ],
    };
  }
  const hermanas = Array.from(
    { length: Math.max(0, fila.propuestasCount - 1) },
    (_, i) =>
      propuestaCaso(100 + i, {
        score: null,
        diferenciaMonto: '10.0000',
      }),
  );
  return {
    ...base,
    estado: 'sugerencia',
    propuestas: [propuestaMejor, ...hermanas],
  };
}
