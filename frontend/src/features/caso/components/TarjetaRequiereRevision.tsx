import { useId } from 'react';
import { REQUIERE_REVISION } from '@/features/caso/textos';
import { formatearDiaDeInstante } from '@/features/caso/fecha';
import comunes from './bloques.module.css';
import estilos from './TarjetaRequiereRevision.module.css';

export interface TarjetaRequiereRevisionProps {
  /** «serie-folio» de cada CFDI cancelado, como en el resto del caso; vacío si ninguno se identifica. */
  etiquetasCanceladas: readonly string[];
  /** Nombre de quien confirmó; `null` si el servidor no lo devolvió. */
  usuario: string | null;
  /** Instante ISO de la confirmación; `null` si el servidor no lo devolvió. */
  confirmadaAt: string | null;
}

/**
 * Variante de solo lectura de un caso confirmado cuya factura se canceló
 * después. Cuadra no lo reabre: sin controles de decisión; reabrir es de otra
 * historia. El estado lo decide el servidor, nunca el rol de quien mira.
 */
export function TarjetaRequiereRevision({
  etiquetasCanceladas,
  usuario,
  confirmadaAt,
}: TarjetaRequiereRevisionProps) {
  const titulo = useId();
  const fecha =
    confirmadaAt === null ? null : formatearDiaDeInstante(confirmadaAt);
  return (
    <section
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={`${comunes.rotulo} ${estilos.rotulo}`}>
        {REQUIERE_REVISION.titulo}
      </h3>
      <p className={estilos.parrafo}>
        {REQUIERE_REVISION.cancelada(etiquetasCanceladas)}
      </p>
      <span className={estilos.nota}>
        {REQUIERE_REVISION.nota(usuario, fecha)}
      </span>
    </section>
  );
}
