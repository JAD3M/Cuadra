// Fechas con hora del detalle. Un instante (`confirmadaAt`, `createdAt`) SÍ
// se muestra en la zona del navegador; una fecha `YYYY-MM-DD` sin hora usa
// `formatearFecha` de la bandeja, que no pasa por `Date`.

function partesDe(iso: string, zona: string | undefined) {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
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
  return {
    dia: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}

/**
 * `YYYY-MM-DD HH:mm` de un instante ISO. `zona` es una zona IANA (las pruebas
 * la inyectan para no depender de la del equipo); sin ella, la del navegador.
 * Un valor que no es un instante se devuelve tal cual.
 */
export function formatearInstante(iso: string, zona?: string): string {
  const partes = partesDe(iso, zona);
  return partes === null ? iso : `${partes.dia} ${partes.hora}`;
}

/** `YYYY-MM-DD` del día de un instante ISO, en la misma zona. */
export function formatearDiaDeInstante(iso: string, zona?: string): string {
  return partesDe(iso, zona)?.dia ?? iso;
}
