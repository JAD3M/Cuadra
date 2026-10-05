/**
 * Fecha de una fila a partir de su cadena `YYYY-MM-DD`, separada por texto y
 * nunca a través de `Date`: un `Date` interpreta la cadena como UTC y la
 * muestra en la zona local, lo que corre el día en zonas al oeste. Una cadena
 * con otra forma se devuelve tal cual, sin inventar una fecha.
 */
export function formatearFecha(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (partes === null) return iso;
  const [, anio, mes, dia] = partes;
  return `${anio}-${mes}-${dia}`;
}
