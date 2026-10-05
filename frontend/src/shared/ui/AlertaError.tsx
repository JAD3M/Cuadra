import type { ReactNode, Ref } from 'react';
import estilos from './AlertaError.module.css';

export interface AlertaErrorProps {
  titulo: string;
  detalle?: string;
  /** Acción de recuperación (p. ej. «Reintentar») dentro de la alerta. */
  accion?: ReactNode;
  /** Permite enlazarla desde `aria-describedby` de un control. */
  id?: string;
  /** Referencia para mover el foco a la alerta tras un fallo. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Alerta de fallo. `role="alert"` la anuncia al aparecer y `tabIndex={-1}`
 * permite enfocarla desde código sin meterla en el orden de tabulación.
 */
export function AlertaError({
  titulo,
  detalle,
  accion,
  id,
  ref,
}: AlertaErrorProps) {
  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className={estilos.alerta}
    >
      <svg
        className={estilos.icono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>{titulo}</strong>
        {detalle && <span className={estilos.detalle}>{detalle}</span>}
        {accion}
      </div>
    </div>
  );
}
