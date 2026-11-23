// Formato de fechas y avance de la muestra. Los días `AAAA-MM-DD` se separan
// como texto, nunca con `Date`: un `Date` los lee como UTC y corre el día en
// zonas al oeste. Un instante sí se muestra en la zona del navegador.

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** `'2026-09'` como «septiembre 2026»; lo que no sea `AAAA-MM` vuelve tal cual. */
export function etiquetaMes(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  const nombre = m === null ? undefined : MESES[Number(m[2]) - 1];
  return nombre === undefined ? mes : `${nombre} ${m?.[1]}`;
}

/** `'2026-09-12'` como «12 sep 2026»; otra forma vuelve tal cual. */
export function diaCorto(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  const nombre = m === null ? undefined : MESES_CORTOS[Number(m[2]) - 1];
  return nombre === undefined ? dia : `${Number(m?.[3])} ${nombre} ${m?.[1]}`;
}

/**
 * Un instante ISO como «22 nov 2026, 10:42». `zona` es una zona IANA (las
 * pruebas la fijan); sin ella, la del navegador. Un valor que no es un
 * instante vuelve tal cual.
 */
export function instanteCorto(iso: string, zona?: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  const mes = MESES_CORTOS[Number(valor('month')) - 1] ?? valor('month');
  return `${Number(valor('day'))} ${mes} ${valor('year')}, ${valor('hour')}:${valor('minute')}`;
}

/** Porcentaje entero de casos verificados (son conteos, no montos). */
export function porcentaje(verificados: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((verificados / total) * 100));
}
