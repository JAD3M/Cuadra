import { Link } from 'react-router';
import {
  TERMINALES,
  TEXTOS_INVITACION,
  type MotivoTerminal,
} from '@/features/invitaciones/textos';
import estilos from './EstadoTerminalInvitacion.module.css';

export interface EstadoTerminalInvitacionProps {
  motivo: MotivoTerminal;
}

/**
 * Enlace que ya no sirve (mockup `Invitacion.dc.html`: `usada`, `caducada`,
 * `reemplazada`, `desconocida` y `sin_cuenta_inactiva`). No muestra datos de
 * la empresa ni de la cuenta. Solo `usada` ofrece ir a iniciar sesión.
 */
export function EstadoTerminalInvitacion({
  motivo,
}: EstadoTerminalInvitacionProps) {
  const { titulo, texto } = TERMINALES[motivo];
  return (
    <div role="status" className={estilos.tarjeta}>
      <svg
        className={estilos.icono}
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5v.5" />
      </svg>
      <h1 className={estilos.titulo}>{titulo}</h1>
      <p className={estilos.texto}>{texto}</p>
      {motivo === 'usada' && (
        <Link to="/login" className={estilos.accion}>
          {TEXTOS_INVITACION.irAIniciarSesion}
        </Link>
      )}
    </div>
  );
}
