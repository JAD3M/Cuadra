import Decimal from 'decimal.js';

/**
 * Historia 9.5 (FR-37, SM-C1, AD-10). La condición del PRD para considerar el
 * cierre automático. Función pura sobre conteos: no toca la base, no guarda
 * nada y no activa nada (AD-3: el cierre por el sistema no existe en la v2).
 *
 * Las comparaciones son con enteros, nunca con flotante: `d / n <= 0.005` es
 * `200 · d <= n`, y la más alta de dos tasas se decide por productos cruzados.
 * Solo el texto de cada tasa pasa por `Decimal`, con cuatro decimales como en
 * la 9.1 y la 9.2.
 */

export const UMBRAL_PROPUESTAS = 1000;
export const UMBRAL_EMPRESAS = 3;
export const UMBRAL_MESES = 3;
/** 0.5 % como texto de cuatro decimales. */
export const TASA_MAXIMA = '0.0050';

export interface ConteosCondicion {
  /** Propuestas de la regla 1 evaluadas, de todas las empresas. */
  propuestas: number;
  /** Empresas distintas con al menos una propuesta. */
  empresas: number;
  /** Meses calendario (UTC) distintos con al menos una propuesta. */
  meses: number;
  /** Propuestas tratadas por la persona: la muestra de la tasa (6.2). */
  tratadas: number;
  desacuerdos: number;
  /** Casos de la muestra con alguna marca; vale la última (9.4). */
  verificados: number;
  desacuerdosMuestra: number;
}

export interface CriterioUmbral {
  pide: number;
  hoy: number;
  /** Cuántas faltan para el umbral; nunca negativa. */
  falta: number;
  cumple: boolean;
}

export interface MedidaDeTasa {
  casos: number;
  desacuerdos: number;
  /** Cuatro decimales; `null` sin casos (no un cero que afirme un acuerdo). */
  tasa: string | null;
}

export type MedidaUsada = 'registradas' | 'muestra';

export interface TasaDeLaCondicion {
  registradas: MedidaDeTasa;
  muestra: MedidaDeTasa;
  /** La más alta de las dos; `null` si no hay ninguna. */
  usada: MedidaUsada | null;
  tasaUsada: string | null;
  /** Cuánto pasa la tasa usada del máximo; `0.0000` si está dentro. */
  exceso: string | null;
  maxima: string;
  cumple: boolean;
}

export interface CondicionCierre {
  cumple: boolean;
  criterios: {
    propuestas: CriterioUmbral;
    empresas: CriterioUmbral;
    meses: CriterioUmbral;
  };
  tasa: TasaDeLaCondicion;
}

function umbral(pide: number, hoy: number): CriterioUmbral {
  return {
    pide,
    hoy,
    falta: Math.max(0, pide - hoy),
    cumple: hoy >= pide,
  };
}

function texto(desacuerdos: number, casos: number): string | null {
  if (casos === 0) return null;
  return new Decimal(desacuerdos).div(casos).toFixed(4);
}

function medida(casos: number, desacuerdos: number): MedidaDeTasa {
  return { casos, desacuerdos, tasa: texto(desacuerdos, casos) };
}

export function evaluarCondicionCierre(c: ConteosCondicion): CondicionCierre {
  const registradas = medida(c.tratadas, c.desacuerdos);
  const muestra = medida(c.verificados, c.desacuerdosMuestra);

  let usada: MedidaUsada | null = null;
  if (registradas.casos > 0 && muestra.casos > 0) {
    // d1/n1 >= d2/n2  <=>  d1·n2 >= d2·n1; en empate manda la de las respuestas.
    usada =
      registradas.desacuerdos * muestra.casos >=
      muestra.desacuerdos * registradas.casos
        ? 'registradas'
        : 'muestra';
  } else if (registradas.casos > 0) {
    usada = 'registradas';
  } else if (muestra.casos > 0) {
    usada = 'muestra';
  }

  const elegida = usada === 'registradas' ? registradas : muestra;
  const tasaUsada = usada === null ? null : elegida.tasa;
  const dentro = usada !== null && 200 * elegida.desacuerdos <= elegida.casos;
  const exceso =
    tasaUsada === null
      ? null
      : dentro
        ? '0.0000'
        : // Con la tasa exacta y hacia arriba: si no cumple, nunca sale en cero.
          new Decimal(elegida.desacuerdos)
            .div(elegida.casos)
            .minus(TASA_MAXIMA)
            .toFixed(4, Decimal.ROUND_CEIL);

  // Supuesto A2: sin una de las dos medidas el criterio no se cumple.
  const tasa: TasaDeLaCondicion = {
    registradas,
    muestra,
    usada,
    tasaUsada,
    exceso,
    maxima: TASA_MAXIMA,
    cumple: dentro && registradas.casos > 0 && muestra.casos > 0,
  };

  const criterios = {
    propuestas: umbral(UMBRAL_PROPUESTAS, c.propuestas),
    empresas: umbral(UMBRAL_EMPRESAS, c.empresas),
    meses: umbral(UMBRAL_MESES, c.meses),
  };

  return {
    cumple:
      criterios.propuestas.cumple &&
      criterios.empresas.cumple &&
      criterios.meses.cumple &&
      tasa.cumple,
    criterios,
    tasa,
  };
}
