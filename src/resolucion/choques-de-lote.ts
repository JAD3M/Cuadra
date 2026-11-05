/** Lo mínimo de una propuesta marcada para saber con quién choca. */
export interface PropuestaMarcada {
  id: string;
  movimientoId: string;
  cfdiIds: readonly string[];
}

/**
 * Ids de las propuestas marcadas que chocan con OTRA marcada del mismo lote:
 * comparten el movimiento o alguna factura. Confirmar una cerraría la otra, y
 * elegir cuál al azar podría cerrar la equivocada: un falso positivo es peor
 * que no conciliar. Por eso AMBAS se dejan fuera y las decide una persona, caso
 * por caso. Función pura: no toca la base.
 */
export function idsQueChocan(
  marcadas: readonly PropuestaMarcada[],
): Set<string> {
  const porLlave = new Map<string, string[]>();
  const anotar = (llave: string, id: string) => {
    const ids = porLlave.get(llave) ?? [];
    ids.push(id);
    porLlave.set(llave, ids);
  };
  for (const m of marcadas) {
    anotar(`m:${m.movimientoId}`, m.id);
    for (const cfdi of new Set(m.cfdiIds)) anotar(`c:${cfdi}`, m.id);
  }
  const chocan = new Set<string>();
  for (const ids of porLlave.values()) {
    if (ids.length > 1) for (const id of ids) chocan.add(id);
  }
  return chocan;
}
