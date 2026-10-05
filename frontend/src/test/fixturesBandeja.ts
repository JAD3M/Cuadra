import Decimal from 'decimal.js';
import { http, HttpResponse } from 'msw';
import type { FilaBandeja, ResumenBandeja } from '@/shared/api/contratos';
import { ESTADOS_BANDEJA } from '@/shared/dominio/bandeja';

// Datos de ejemplo de la bandeja (CU-22) con la forma exacta que responde la
// API. Los comparten las pruebas de hooks, de pantalla y de flujos. Los montos
// son siempre cadenas decimales; `decimal.js` solo se usa aquí, en código de
// pruebas, para armar el resumen.

/** Prefijo completo que el backend guarda en el motivo de una sugerencia simulada. */
export const MOTIVO_IA_SIMULADA =
  'Sugerencia de IA: [SIMULADA — no es un modelo real] Coincide el monto y la fecha.';
export const MOTIVO_IA_REAL =
  'Sugerencia de IA: El importe y el concepto coinciden con el CFDI.';

/** Guid determinista a partir de un entero, para que las filas sean estables. */
export function idDe(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Una fila `sin_match` por defecto; cada prueba cambia solo lo que le importa. */
export function filaBandeja(overrides: Partial<FilaBandeja> = {}): FilaBandeja {
  return {
    movimientoId: idDe(1),
    fecha: '2026-09-02',
    monto: '1160.0000',
    descripcion: 'SPEI recibido Ferreteria del Bajio',
    referencia: null,
    moneda: 'MXN',
    estado: 'sin_match',
    propuestasCount: 0,
    motivo: 'No hay un CFDI con ese monto.',
    regla: 'sin_candidato_monto',
    mejorPropuesta: null,
    ...overrides,
  };
}

/** Mejor propuesta con un CFDI; `diferenciaMonto` en cadena decimal. */
export function conPropuesta(
  n: number,
  opciones: {
    diferenciaMonto?: string | null;
    moneda?: string;
    total?: string;
    serie?: string | null;
    folio?: string | null;
  } = {},
): NonNullable<FilaBandeja['mejorPropuesta']> {
  return {
    conciliacionId: idDe(5000 + n),
    diferenciaMonto: opciones.diferenciaMonto ?? '0.0000',
    cfdi: {
      id: idDe(7000 + n),
      uuidFiscal: `A1B2C3D4-0000-4000-8000-${String(n).padStart(12, '0')}`,
      serie: opciones.serie === undefined ? 'A' : opciones.serie,
      folio: opciones.folio === undefined ? String(1000 + n) : opciones.folio,
      total: opciones.total ?? '1160.0000',
      moneda: opciones.moneda ?? 'MXN',
    },
  };
}

function montoDe(n: number): string {
  // Montos distintos y descendentes por índice: el orden es estable.
  return new Decimal(120000).minus(new Decimal(n).times('937.25')).toFixed(4);
}

function construirFilas(): FilaBandeja[] {
  const filas: FilaBandeja[] = [];
  let n = 0;
  const siguiente = () => {
    n += 1;
    return n;
  };

  // 26 sugerencias: la primera con IA simulada, la segunda con IA real, la
  // tercera con una diferencia menor a un centavo y la cuarta en USD.
  for (let i = 0; i < 26; i += 1) {
    const k = siguiente();
    const base = {
      movimientoId: idDe(k),
      monto: montoDe(k),
      descripcion: `Deposito cliente ${k}`,
      referencia: i % 2 === 0 ? `F-${2000 + k}` : null,
      estado: 'sugerencia' as const,
      propuestasCount: 1,
      motivo: null,
      regla: 'referencia_exacta' as string | null,
      mejorPropuesta: conPropuesta(k, { diferenciaMonto: '0.0000' }),
    };
    if (i === 0) {
      filas.push(
        filaBandeja({
          ...base,
          regla: 'llm_sugerencia',
          motivo: MOTIVO_IA_SIMULADA,
        }),
      );
    } else if (i === 1) {
      filas.push(
        filaBandeja({
          ...base,
          regla: 'llm_sugerencia',
          motivo: MOTIVO_IA_REAL,
        }),
      );
    } else if (i === 2) {
      filas.push(
        filaBandeja({
          ...base,
          mejorPropuesta: conPropuesta(k, { diferenciaMonto: '0.0040' }),
        }),
      );
    } else if (i === 3) {
      filas.push(
        filaBandeja({
          ...base,
          monto: '2150.0000',
          moneda: 'USD',
          mejorPropuesta: conPropuesta(k, {
            moneda: 'USD',
            total: '2150.0000',
          }),
        }),
      );
    } else {
      filas.push(filaBandeja(base));
    }
  }

  // 13 sin_match: la primera sin referencia ni CFDI, la segunda con un motivo
  // de regla distinta.
  for (let i = 0; i < 13; i += 1) {
    const k = siguiente();
    filas.push(
      filaBandeja({
        movimientoId: idDe(k),
        monto: montoDe(k),
        descripcion: `Cargo sin identificar ${k}`,
        referencia: i === 0 ? null : `REF-${k}`,
        regla: i === 1 ? 'monto_multiples_candidatos' : 'sin_candidato_monto',
      }),
    );
  }

  // 4 conciliados, que la vista por defecto no muestra.
  for (let i = 0; i < 4; i += 1) {
    const k = siguiente();
    filas.push(
      filaBandeja({
        movimientoId: idDe(k),
        monto: montoDe(k),
        descripcion: `Conciliado ${k}`,
        estado: 'conciliado',
        regla: null,
        motivo: null,
        propuestasCount: 0,
        mejorPropuesta: conPropuesta(k),
      }),
    );
  }
  return filas;
}

/** 43 filas: 26 sugerencia, 13 sin_match y 4 conciliado (39 por revisar). */
export const FILAS_DEMO: readonly FilaBandeja[] = construirFilas();

/** Resumen consistente con un conjunto de filas, igual que el backend. */
export function resumenDe(filas: readonly FilaBandeja[]): ResumenBandeja {
  const conteos = Object.fromEntries(
    ESTADOS_BANDEJA.map((e) => [e, filas.filter((f) => f.estado === e).length]),
  ) as ResumenBandeja['conteos'];
  const porMoneda = new Map<string, Decimal>();
  for (const fila of filas) {
    if (fila.estado === 'conciliado') continue;
    porMoneda.set(
      fila.moneda,
      (porMoneda.get(fila.moneda) ?? new Decimal(0)).plus(fila.monto),
    );
  }
  const montoPorRevisar = [...porMoneda.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([moneda, monto]) => ({ moneda, monto: monto.toFixed(4) }));
  return { conteos, montoPorRevisar };
}

const ERROR_NEST = (status: number) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: 'detalle del servidor' },
    { status },
  );

/** Manejador de `GET /bandeja` que falla con `status`. */
export function bandejaFalla(status: number) {
  return http.get('/api/bandeja', () => ERROR_NEST(status));
}

/** Manejador de `GET /bandeja/resumen` que falla con `status`. */
export function resumenFalla(status: number) {
  return http.get('/api/bandeja/resumen', () => ERROR_NEST(status));
}

/** Corta la conexión de `GET /bandeja` (fallo de red). */
export function bandejaRedDeFallo() {
  return http.get('/api/bandeja', () => HttpResponse.error());
}
