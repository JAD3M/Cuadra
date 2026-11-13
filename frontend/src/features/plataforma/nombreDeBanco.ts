import { NOMBRES_DE_BANCO } from '@/shared/dominio';

/** Lo que ve la persona de un banco: su nombre del catálogo o, si no está, el id en mayúsculas. */
export function nombreDeBanco(id: string): string {
  return NOMBRES_DE_BANCO[id] ?? id.toUpperCase();
}
