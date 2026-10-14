import type { UsuarioPlataforma } from '@/shared/api/contratos/plataforma';
import type { EstadoPlataforma, MotivoFinPlataforma } from './tipos';

export type EventoPlataforma =
  | { tipo: 'RESTAURADA'; usuario: UsuarioPlataforma }
  | { tipo: 'SIN_SESION' }
  | { tipo: 'LOGIN_OK'; usuario: UsuarioPlataforma }
  | { tipo: 'TERMINAR'; motivo: MotivoFinPlataforma }
  | { tipo: 'CONSUMIR' };

export const ESTADO_INICIAL_PLATAFORMA: EstadoPlataforma = {
  status: 'restoring',
};

/**
 * Transiciones de la sesión de plataforma. Un evento que no corresponde a la
 * fase actual devuelve el mismo estado (una respuesta tardía no pisa nada).
 */
export function reducirPlataforma(
  estado: EstadoPlataforma,
  evento: EventoPlataforma,
): EstadoPlataforma {
  switch (evento.tipo) {
    case 'RESTAURADA':
      return estado.status === 'restoring'
        ? { status: 'ready', usuario: evento.usuario }
        : estado;
    case 'SIN_SESION':
      return estado.status === 'restoring' ? { status: 'anonymous' } : estado;
    case 'LOGIN_OK':
      return estado.status === 'anonymous' || estado.status === 'ended'
        ? { status: 'ready', usuario: evento.usuario }
        : estado;
    case 'TERMINAR':
      return estado.status === 'ready'
        ? { status: 'ended', motivo: evento.motivo }
        : estado;
    case 'CONSUMIR':
      return estado.status === 'ended' ? { status: 'anonymous' } : estado;
  }
}
