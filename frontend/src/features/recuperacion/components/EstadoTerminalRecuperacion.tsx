import { Link } from 'react-router';
import {
  TERMINALES_RECUPERACION,
  TEXTOS_RECUPERACION,
  type EstadoTerminalRecuperacion as Estado,
} from '@/features/recuperacion/textos';
import estilos from './EstadoTerminalRecuperacion.module.css';

export interface EstadoTerminalRecuperacionProps {
  estado: Estado;
}

const CON_LOGIN: readonly Estado[] = ['enviado', 'exito', 'usada'];
const CON_PEDIR: readonly Estado[] = [
  'usada',
  'caducada',
  'reemplazada',
  'desconocida',
];

/**
 * Estado que cierra la pantalla (mockup `Recuperar.dc.html`: `enviado`,
 * `exito`, `usada`, `caducada`, `reemplazada`, `desconocida` y
 * `cuenta_desactivada`). No muestra datos de la cuenta. «Pedir un enlace
 * nuevo» es secundario solo cuando también se ofrece iniciar sesión.
 */
export function EstadoTerminalRecuperacion({
  estado,
}: EstadoTerminalRecuperacionProps) {
  const { titulo, texto } = TERMINALES_RECUPERACION[estado];
  const verLogin = CON_LOGIN.includes(estado);
  const verPedir = CON_PEDIR.includes(estado);
  return (
    <div role="status" className={estilos.tarjeta}>
      <svg
        className={`${estilos.icono} ${estado === 'exito' ? estilos.exito : ''}`}
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
        {estado === 'exito' ? (
          <path d="M8 12.5l3 3 5-6" />
        ) : (
          <path d="M12 11v5M12 7.5v.5" />
        )}
      </svg>
      <h1 className={estilos.titulo}>{titulo}</h1>
      <p className={estilos.texto}>{texto}</p>
      {(verLogin || verPedir) && (
        <div className={estilos.acciones}>
          {verLogin && (
            <Link to="/login" className={estilos.accion}>
              {TEXTOS_RECUPERACION.irAIniciarSesion}
            </Link>
          )}
          {verPedir && (
            <Link
              to="/recuperar"
              className={estado === 'usada' ? estilos.secundaria : estilos.accion}
            >
              {TEXTOS_RECUPERACION.pedirNuevo}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
