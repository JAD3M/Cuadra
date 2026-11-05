import {
  etiquetaCfdi,
  type CfdiEtiquetable,
} from '@/features/bandeja/etiquetaCfdi';

/** Lo mínimo de una factura para saber si está cancelada y nombrarla. */
export interface CfdiConEstado extends CfdiEtiquetable {
  estado: string;
}

export interface PropuestaConFacturas {
  /** Primera factura (id ascendente); en un grupo no es necesariamente la cancelada. */
  cfdi: CfdiConEstado;
  /** Todas las facturas de la decisión; un grupo tiene varias. */
  cfdis?: readonly CfdiConEstado[];
}

/**
 * Etiquetas de las facturas de la decisión cuyo estado es `cancelada`, en el
 * orden del servidor. Solo nombra las que el servidor marca así: si ninguna lo
 * está (datos incoherentes) devuelve vacío en vez de adivinar una.
 */
export function etiquetasCanceladas(propuesta: PropuestaConFacturas): string[] {
  const facturas =
    propuesta.cfdis !== undefined && propuesta.cfdis.length > 0
      ? propuesta.cfdis
      : [propuesta.cfdi];
  return facturas
    .filter((f) => f.estado === 'cancelada')
    .map((f) => etiquetaCfdi(f));
}
