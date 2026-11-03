import { BANCOS_PDF } from '@/shared/dominio';

/** Lo que ve la persona de un banco: su nombre del catálogo o, si no está, el id en mayúsculas. */
export function nombreDeBanco(id: string): string {
  return BANCOS_PDF.find((b) => b.id === id)?.nombre ?? id.toUpperCase();
}
