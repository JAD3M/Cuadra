import { AVISO_SOLO_ADMIN } from '@/features/tolerancia/textos';
import estilos from './AvisoSoloAdmin.module.css';

/**
 * Lo que ve quien no administra la empresa en lugar del formulario (contador y
 * revisor por igual). Nota, no alerta: informa y no pide nada. Es comodidad;
 * el servidor decide quién puede cambiar la tolerancia.
 */
export function AvisoSoloAdmin() {
  return (
    <div role="note" className={estilos.aviso}>
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
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>{AVISO_SOLO_ADMIN}</span>
    </div>
  );
}
