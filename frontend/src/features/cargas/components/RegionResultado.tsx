import type { ReactNode, Ref } from 'react';
import { SUBIENDO_ARCHIVOS } from '@/features/cargas/textos';
import estilos from './RegionResultado.module.css';

export interface RegionResultadoProps {
  subiendo: boolean;
  /** Para que quien sube mueva el foco aquí al enviar. */
  regionRef?: Ref<HTMLDivElement>;
  /** El resultado de la carga; la región lo anuncia al aparecer. */
  children?: ReactNode;
}

/**
 * Región de estado de una tarjeta. Está SIEMPRE montada (vacía) y se llena
 * después: los lectores de pantalla anuncian de forma fiable el contenido que
 * aparece en una región que ya existía. Anuncia «Subiendo tus archivos» y,
 * después, el resumen del resultado. Al enviar, el botón pulsado se deshabilita
 * y el foco caería al `body`; por eso la región se puede enfocar desde código
 * (`tabIndex={-1}`) y recibe el foco una sola vez.
 *
 * No hay control para cerrarla (M13): la siguiente subida la reemplaza.
 */
export function RegionResultado({
  subiendo,
  regionRef,
  children,
}: RegionResultadoProps) {
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
      {children}
    </div>
  );
}
