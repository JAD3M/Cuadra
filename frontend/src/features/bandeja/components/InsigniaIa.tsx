import { EstadoChip } from '@/shared/ui/EstadoChip';
import {
  INSIGNIA_GLIFO,
  INSIGNIA_IA,
  INSIGNIA_IA_SIMULADA,
} from '@/features/bandeja/textos';

export interface InsigniaIaProps {
  /** `true` solo cuando el motivo guardado es el del proveedor simulado. */
  simulada: boolean;
}

/**
 * Insignia «✦ IA» de una sugerencia del modelo, con «· simulada» cuando la
 * generó el proveedor simulado. El glifo es decorativo (`aria-hidden`): el
 * significado lo lleva el texto.
 */
export function InsigniaIa({ simulada }: InsigniaIaProps) {
  return (
    <EstadoChip tono="ia">
      <span aria-hidden="true">{INSIGNIA_GLIFO}</span>
      {simulada ? INSIGNIA_IA_SIMULADA : INSIGNIA_IA}
    </EstadoChip>
  );
}
