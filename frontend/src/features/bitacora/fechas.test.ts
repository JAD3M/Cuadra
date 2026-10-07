import { afterEach, describe, expect, it } from 'vitest';
import {
  esDiaValido,
  esRangoInvertido,
  inicioDelDia,
  inicioDelDiaSiguiente,
} from './fechas';

// Los días del filtro son días LOCALES del navegador (D6): la misma fecha
// «2026-09-30» es otro instante en cada zona. Cada caso fija la zona con
// `process.env.TZ` (Node relee la zona al asignarla) y la restaura al salir.
// Si el pool de vitest ignorara el cambio en tiempo de ejecución, la prueba
// guardia de abajo falla en voz alta en lugar de dejar pasar una tabla vacía.

// `src` no declara los tipos de Node (ver `src/test/setup.ts`): el entorno se
// toca por un acceso tipado a mano.
const entorno = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

const ZONA_ORIGINAL = entorno.TZ;

function conZona<T>(zona: string, fn: () => T): T {
  entorno.TZ = zona;
  try {
    return fn();
  } finally {
    if (ZONA_ORIGINAL === undefined) delete entorno.TZ;
    else entorno.TZ = ZONA_ORIGINAL;
  }
}

afterEach(() => {
  if (ZONA_ORIGINAL === undefined) delete entorno.TZ;
  else entorno.TZ = ZONA_ORIGINAL;
});

describe('guardia de la zona horaria', () => {
  // getTimezoneOffset devuelve minutos al oeste de UTC: julio 2026.
  it.each([
    ['America/Mexico_City', 360], // UTC-6, sin horario de verano desde 2022
    ['America/New_York', 240], // UTC-4 (EDT en julio)
    ['America/Havana', 240], // UTC-4 (CDT en julio)
    ['UTC', 0],
  ])('%s se aplica de verdad (offset %i min)', (zona, offset) => {
    conZona(zona, () => {
      expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(offset);
    });
  });
});

describe('inicioDelDia / inicioDelDiaSiguiente en Ciudad de México (UTC-6)', () => {
  it.each([
    ['2026-09-30', '2026-09-30T06:00:00.000Z', '2026-10-01T06:00:00.000Z'],
    // Fin de mes y de febrero (año común y bisiesto).
    ['2026-02-28', '2026-02-28T06:00:00.000Z', '2026-03-01T06:00:00.000Z'],
    ['2028-02-29', '2028-02-29T06:00:00.000Z', '2028-03-01T06:00:00.000Z'],
    ['2026-01-31', '2026-01-31T06:00:00.000Z', '2026-02-01T06:00:00.000Z'],
    // Fin de año.
    ['2026-12-31', '2026-12-31T06:00:00.000Z', '2027-01-01T06:00:00.000Z'],
  ])('%s: inicio %s, siguiente %s', (dia, inicio, siguiente) => {
    conZona('America/Mexico_City', () => {
      expect(inicioDelDia(dia)).toBe(inicio);
      expect(inicioDelDiaSiguiente(dia)).toBe(siguiente);
    });
  });
});

describe('cambios de horario (el día no dura 24 h)', () => {
  it('Nueva York, fin del horario de verano 2026-11-01: el día dura 25 h', () => {
    conZona('America/New_York', () => {
      expect(inicioDelDia('2026-11-01')).toBe('2026-11-01T04:00:00.000Z');
      expect(inicioDelDiaSiguiente('2026-11-01')).toBe(
        '2026-11-02T05:00:00.000Z',
      );
    });
  });

  it('Nueva York, inicio del horario de verano 2026-03-08: el día dura 23 h', () => {
    conZona('America/New_York', () => {
      expect(inicioDelDia('2026-03-08')).toBe('2026-03-08T05:00:00.000Z');
      expect(inicioDelDiaSiguiente('2026-03-08')).toBe(
        '2026-03-09T04:00:00.000Z',
      );
    });
  });

  it('La Habana, la medianoche 2026-03-08 no existe: empieza en el primer instante válido', () => {
    conZona('America/Havana', () => {
      expect(inicioDelDia('2026-03-08')).toBe('2026-03-08T05:00:00.000Z');
    });
  });
});

describe('UTC', () => {
  it('es la identidad: el día local es el día UTC', () => {
    conZona('UTC', () => {
      expect(inicioDelDia('2026-09-30')).toBe('2026-09-30T00:00:00.000Z');
      expect(inicioDelDiaSiguiente('2026-09-30')).toBe(
        '2026-10-01T00:00:00.000Z',
      );
      expect(inicioDelDiaSiguiente('2026-12-31')).toBe(
        '2027-01-01T00:00:00.000Z',
      );
    });
  });
});

describe('esDiaValido', () => {
  it.each(['2026-09-30', '2028-02-29', '2000-01-01', '2026-12-31'])(
    'acepta %s',
    (dia) => {
      expect(esDiaValido(dia)).toBe(true);
    },
  );

  it.each([
    ['2026-02-31', 'día que el mes no tiene'],
    ['2027-02-29', 'bisiesto que no lo es'],
    ['2026-13-01', 'mes 13'],
    ['2026-00-10', 'mes 0'],
    ['2026-01-00', 'día 0'],
    ['26-1-1', 'formato corto'],
    ['2026-9-30', 'sin cero a la izquierda'],
    ['2026-09-30T00:00', 'con hora'],
    [' 2026-09-30', 'con espacio'],
    ['', 'cadena vacía'],
    ['1999-12-31', 'antes del año 2000'],
  ])('rechaza %j (%s)', (dia) => {
    expect(esDiaValido(dia)).toBe(false);
  });
});

describe('esRangoInvertido', () => {
  it('Desde posterior a Hasta está invertido', () => {
    expect(esRangoInvertido('2026-09-30', '2026-09-29')).toBe(true);
    expect(esRangoInvertido('2027-01-01', '2026-12-31')).toBe(true);
  });

  it('Desde anterior a Hasta es válido', () => {
    expect(esRangoInvertido('2026-09-29', '2026-09-30')).toBe(false);
  });

  it('el mismo día en ambos lados es válido (un día completo)', () => {
    expect(esRangoInvertido('2026-09-30', '2026-09-30')).toBe(false);
  });

  it('con un solo lado no hay rango que invertir', () => {
    expect(esRangoInvertido('2026-09-30', undefined)).toBe(false);
    expect(esRangoInvertido(undefined, '2026-09-30')).toBe(false);
    expect(esRangoInvertido(undefined, undefined)).toBe(false);
  });
});
