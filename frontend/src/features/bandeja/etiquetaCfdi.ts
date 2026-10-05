import { SIN_DATO } from '@/features/bandeja/textos';

/** Largo del identificador corto cuando el CFDI no trae serie ni folio. */
const LARGO_UUID_CORTO = 8;

/** Lo mínimo del CFDI que la etiqueta necesita; no importa el contrato de la API. */
export interface CfdiEtiquetable {
  uuidFiscal: string;
  serie: string | null;
  folio: string | null;
}

/**
 * Etiqueta del CFDI candidato: «serie-folio» (o la parte que exista); sin
 * ninguna de las dos, los primeros 8 caracteres de su UUID fiscal; sin
 * propuesta, un guion.
 */
export function etiquetaCfdi(cfdi: CfdiEtiquetable | null): string {
  if (cfdi === null) return SIN_DATO;
  const partes = [cfdi.serie, cfdi.folio].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  );
  if (partes.length > 0) return partes.join('-');
  return cfdi.uuidFiscal.slice(0, LARGO_UUID_CORTO);
}
