import { ETIQUETAS_ESTADO_CARGA } from '@/shared/dominio';
import { EstadoChip, type TonoEstadoChip } from '@/shared/ui/EstadoChip';
import { TONO_ESTADO_CARGA } from '@/features/cargas/tonos';
import { CHIP } from '@/features/vista-previa/textos';

/** En qué punto va la decisión de la persona sobre la vista previa. */
export type FaseVistaPrevia =
  'espera' | 'aceptando' | 'rechazando' | 'aceptada' | 'rechazada';

const CHIPS: Readonly<
  Record<FaseVistaPrevia, { texto: string; tono: TonoEstadoChip }>
> = {
  espera: {
    texto: ETIQUETAS_ESTADO_CARGA.pendiente_vista_previa,
    tono: TONO_ESTADO_CARGA.pendiente_vista_previa,
  },
  aceptando: { texto: CHIP.importando, tono: 'sugerencia' },
  rechazando: { texto: CHIP.rechazando, tono: 'sin_match' },
  aceptada: {
    texto: ETIQUETAS_ESTADO_CARGA.procesada,
    tono: TONO_ESTADO_CARGA.procesada,
  },
  rechazada: {
    texto: ETIQUETAS_ESTADO_CARGA.rechazada,
    tono: TONO_ESTADO_CARGA.rechazada,
  },
};

export interface EstadoVistaPreviaProps {
  fase: FaseVistaPrevia;
}

/** El chip junto al título: el estado de la carga según la decisión en curso. */
export function EstadoVistaPrevia({ fase }: EstadoVistaPreviaProps) {
  const { texto, tono } = CHIPS[fase];
  return <EstadoChip tono={tono}>{texto}</EstadoChip>;
}
