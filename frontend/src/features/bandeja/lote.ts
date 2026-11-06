import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio';
import type { MotivoBloqueo } from '@/shared/dominio/tipos';

/** Lo que el lote necesita de una fila; la fila del contrato la cumple. */
export interface FilaParaLote {
  estado: EstadoBandeja;
  requiereRevision?: boolean;
  regla: string | null;
  motivoBloqueo?: MotivoBloqueo | null;
  mejorPropuesta: { conciliacionId?: string } | null;
}

/**
 * La propuesta que una fila aporta al lote, o `null` si no entra: solo una
 * sugerencia con propuesta abierta. Un sin match, un conciliado o uno que
 * pide revisión no tienen nada que confirmar aquí.
 */
export function propuestaDeLote(fila: FilaParaLote): string | null {
  if (fila.estado !== 'sugerencia' || fila.requiereRevision === true) {
    return null;
  }
  return fila.mejorPropuesta?.conciliacionId ?? null;
}

/** Esta persona no puede confirmarla (separación de funciones): no se marca. */
export function estaBloqueada(fila: FilaParaLote): boolean {
  return fila.motivoBloqueo != null;
}

/** Ids que se pueden marcar: lo que entra al lote y no está bloqueado. */
export function marcables(filas: readonly FilaParaLote[]): string[] {
  const ids: string[] = [];
  for (const fila of filas) {
    const id = propuestaDeLote(fila);
    if (id !== null && !estaBloqueada(fila)) ids.push(id);
  }
  return ids;
}

/**
 * Lo que viene marcado al abrir el lote (FR-18): SOLO la regla 1. El depósito
 * con varias facturas, las reglas 2 y 3 y la sugerencia de la IA vienen
 * desmarcados; una bloqueada nunca se marca. La persona decide el resto.
 */
export function marcadasIniciales(filas: readonly FilaParaLote[]): Set<string> {
  const ids = new Set<string>();
  for (const fila of filas) {
    const id = propuestaDeLote(fila);
    if (
      id !== null &&
      !estaBloqueada(fila) &&
      fila.regla === REGLA_REFERENCIA_MONTO_EXACTO
    ) {
      ids.add(id);
    }
  }
  return ids;
}
