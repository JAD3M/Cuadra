/** Ruta de la vista previa de una carga en espera (historia 3.4). */
export const rutaVistaPrevia = (cargaId: string): string =>
  `/cargas/${encodeURIComponent(cargaId)}/vista-previa`;
