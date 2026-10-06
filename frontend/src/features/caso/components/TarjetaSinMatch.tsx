import { useId } from 'react';
import { SIN_MATCH } from '@/features/caso/textos';
import comunes from './bloques.module.css';
import estilos from './TarjetaSinMatch.module.css';

export interface TarjetaSinMatchProps {
  /** Regla del motor que no encontró propuesta; se muestra verbatim. */
  regla: string | null;
  /** Motivo del servidor, verbatim. */
  motivo: string | null;
}

/**
 * Variante de solo lectura de un caso sin propuestas: lo que dice el motor y,
 * si el servidor lo trae, el motivo y el código de la regla. Sin CFDI, sin
 * lista y sin controles de decisión.
 */
export function TarjetaSinMatch({ regla, motivo }: TarjetaSinMatchProps) {
  const titulo = useId();
  return (
    <section
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={`${comunes.rotulo} ${estilos.rotulo}`}>
        {SIN_MATCH.titulo}
      </h3>
      <p className={estilos.parrafo}>{SIN_MATCH.principal}</p>
      <p className={estilos.parrafo}>{SIN_MATCH.secundaria}</p>
      {motivo === null ? null : <span className={estilos.nota}>{motivo}</span>}
      {regla === null ? null : <span className={estilos.regla}>{regla}</span>}
    </section>
  );
}
