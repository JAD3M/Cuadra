import type { Ref } from 'react';
import { SUBIENDO_ARCHIVOS } from '@/features/cargas/textos';
import estilos from './RegionSubida.module.css';

export interface RegionSubidaProps {
  subiendo: boolean;
  /** Para que quien sube mueva el foco aquí al enviar. */
  regionRef?: Ref<HTMLDivElement>;
}

/**
 * Región de estado de una tarjeta. Está SIEMPRE montada (vacía) y se llena
 * después: los lectores de pantalla anuncian de forma fiable el contenido que
 * aparece en una región que ya existía. Al enviar, el botón pulsado se
 * deshabilita y el foco caería al `body`; por eso la región se puede enfocar
 * desde código (`tabIndex={-1}`) y recibe el foco una sola vez.
 */
export function RegionSubida({ subiendo, regionRef }: RegionSubidaProps) {
  return (
    <div
      ref={regionRef}
      role="status"
      // Enfocable solo por código, sin entrar al orden de tabulación.
      tabIndex={-1}
      className={estilos.region}
    >
      {subiendo ? (
        <span className="solo-lectores">{SUBIENDO_ARCHIVOS}</span>
      ) : null}
    </div>
  );
}
