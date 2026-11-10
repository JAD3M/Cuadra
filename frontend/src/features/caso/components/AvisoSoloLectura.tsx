import { DECISION } from '@/features/caso/textos';
import { AvisoInfo } from './AvisoInfo';

/**
 * Nota del detalle para quien no puede confirmar ni rechazar (por ejemplo,
 * el auditor): ve el caso completo, sin controles de decisión. Reutiliza el
 * estilo informativo del aviso de varias propuestas.
 */
export function AvisoSoloLectura() {
  return <AvisoInfo texto={DECISION.soloLectura} />;
}
