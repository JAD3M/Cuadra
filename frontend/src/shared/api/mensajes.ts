import { ApiError, ContratoError, NetworkError } from '@/shared/api/errores';

export type ContextoMensaje = 'login' | 'seleccion' | 'general';

export type TipoMensaje =
  | 'credenciales'
  | 'sin_empresas'
  | 'sin_acceso'
  | 'sin_permiso'
  | 'conexion'
  | 'otro';

export interface MensajeError {
  titulo: string;
  detalle?: string;
  tipo: TipoMensaje;
}

const CONEXION: MensajeError = {
  titulo: 'No se pudo conectar con el servidor.',
  detalle: 'Inténtalo de nuevo.',
  tipo: 'conexion',
};

const CREDENCIALES: MensajeError = {
  titulo: 'Correo o contraseña incorrectos',
  detalle: 'Revisa tus datos e inténtalo de nuevo.',
  tipo: 'credenciales',
};

const SIN_EMPRESAS: MensajeError = {
  titulo: 'Tu usuario no tiene empresas asignadas.',
  detalle: 'Contacta a un administrador.',
  tipo: 'sin_empresas',
};

const SIN_ACCESO: MensajeError = {
  titulo: 'Ya no tienes acceso a esta empresa.',
  detalle: 'Elige otra de la lista.',
  tipo: 'sin_acceso',
};

const SIN_PERMISO: MensajeError = {
  titulo: 'No tienes permiso para esta acción.',
  tipo: 'sin_permiso',
};

const OTRO: MensajeError = {
  titulo: 'No se pudo completar la solicitud.',
  tipo: 'otro',
};

function esCancelacion(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Único lugar donde un error se vuelve texto para el usuario. Nunca devuelve
 * el texto del servidor (`ApiError.mensajes`), ni cabeceras ni tokens: solo
 * copia fija según el tipo de fallo. Una cancelación no es un fallo: `null`.
 */
export function mensajeDeError(
  error: unknown,
  contexto: ContextoMensaje = 'general',
): MensajeError | null {
  if (esCancelacion(error)) return null;

  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return CONEXION;
    if (
      contexto === 'login' &&
      (error.statusCode === 401 || error.statusCode === 400)
    ) {
      return CREDENCIALES;
    }
    if (error.statusCode === 403) {
      if (contexto === 'login') return SIN_EMPRESAS;
      if (contexto === 'seleccion') return SIN_ACCESO;
      return SIN_PERMISO;
    }
    return OTRO;
  }

  if (error instanceof NetworkError || error instanceof ContratoError) {
    return CONEXION;
  }

  // Cualquier otra cosa (un error inesperado) no se explica al usuario.
  return OTRO;
}
