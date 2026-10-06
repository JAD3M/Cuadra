import { PROPUESTAS } from '@/features/caso/textos';
import estilos from './AvisoVarias.module.css';

export interface AvisoVariasProps {
  /** Número real de propuestas vigentes del movimiento. */
  cantidad: number;
}

/**
 * Advertencia de que al confirmar una propuesta las demás se rechazan. Solo
 * aparece con dos o más; con una (o ninguna) no hay nada que advertir.
 */
export function AvisoVarias({ cantidad }: AvisoVariasProps) {
  if (cantidad < 2) return null;
  return (
    <div role="status" className={estilos.aviso}>
      <svg
        className={estilos.icono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
      <span>{PROPUESTAS.aviso(cantidad)}</span>
    </div>
  );
}
