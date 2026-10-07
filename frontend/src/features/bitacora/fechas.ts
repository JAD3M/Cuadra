// Días locales del filtro de fechas de la bitácora.
//
// Este archivo queda FUERA del escaneo anti-flotante de dinero (la regla
// «nunca Number ni Math sobre montos»): aquí no hay ningún monto. Lo único
// numérico son el año, el mes y el día de un calendario, que sí se convierten
// con `Number`. El escaneo estático de la pantalla lo lista aparte, con esta
// misma razón.
//
// Semántica (D6): «Desde» y «Hasta» son días del calendario del NAVEGADOR, no
// de UTC. La API filtra por el intervalo semiabierto [desde, hasta), así que
// «Hasta» es inclusivo para la persona y se envía como el inicio del día local
// SIGUIENTE. El día siguiente se calcula con aritmética de calendario, nunca
// sumando 24 h: los días con cambio de horario duran 23 o 25 h y fin de mes o
// de año deben rodar solos.

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Primer año aceptado: antes de esto la fecha es casi seguro un error de captura. */
const ANIO_MINIMO = 2000;

interface PartesDia {
  anio: number;
  mes: number;
  dia: number;
}

/** Año, mes (1-12) y día de una cadena `AAAA-MM-DD` que ya pasó `esDiaValido`. */
function partesDe(dia: string): PartesDia {
  const [anio, mes, d] = dia.split('-');
  return { anio: Number(anio), mes: Number(mes), dia: Number(d) };
}

/**
 * Primer instante del día local `anio-mes-dia` (el día puede desbordar el mes:
 * `dia + 1` rueda al mes o al año siguiente). El año se fija con
 * `setFullYear` y no con el constructor, que trata 0-99 como 1900-1999. Si esa
 * medianoche no existe (cambio de horario a medianoche), JavaScript resuelve al
 * primer instante válido de la fecha, que es el inicio del día local.
 */
function instanteLocal(anio: number, mes: number, dia: number): Date {
  const fecha = new Date(ANIO_MINIMO, 0, 1);
  fecha.setFullYear(anio, mes - 1, dia);
  return fecha;
}

/**
 * `true` si `dia` es una fecha real `AAAA-MM-DD` del año 2000 en adelante.
 * Rechaza `2026-02-31` y `2027-02-29`: el día se reconstruye en UTC y debe dar
 * exactamente los mismos números.
 */
export function esDiaValido(dia: string): boolean {
  if (!FORMATO_DIA.test(dia)) return false;
  const { anio, mes, dia: d } = partesDe(dia);
  if (anio < ANIO_MINIMO) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, d));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === d
  );
}

/** Primer instante del día local `dia`, en ISO UTC. Exige `esDiaValido(dia)`. */
export function inicioDelDia(dia: string): string {
  const { anio, mes, dia: d } = partesDe(dia);
  return instanteLocal(anio, mes, d).toISOString();
}

/**
 * Primer instante del día local SIGUIENTE a `dia`, en ISO UTC: el `hasta` que se
 * envía para que «Hasta» incluya el día completo. Exige `esDiaValido(dia)`.
 */
export function inicioDelDiaSiguiente(dia: string): string {
  const { anio, mes, dia: d } = partesDe(dia);
  return instanteLocal(anio, mes, d + 1).toISOString();
}

/**
 * `true` solo cuando hay ambos lados y «Desde» es posterior a «Hasta». Con
 * `AAAA-MM-DD` la comparación de cadenas es la cronológica; el mismo día en los
 * dos lados es un rango válido (un día completo).
 */
export function esRangoInvertido(
  desde: string | undefined,
  hasta: string | undefined,
): boolean {
  return desde !== undefined && hasta !== undefined && desde > hasta;
}
