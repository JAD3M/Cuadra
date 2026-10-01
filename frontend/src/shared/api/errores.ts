import type { ZodError } from 'zod';
import { cuerpoError } from '@/shared/api/contratos';

const MENSAJE_GENERICO = 'No se pudo completar la solicitud.';

/**
 * Respuesta HTTP no exitosa. Normaliza el cuerpo de error de Nest
 * `{ statusCode, error, message }`, donde `message` es una cadena o, en los
 * fallos de validación, un arreglo de cadenas.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  /** Siempre un arreglo: vacío cuando el servidor no envió mensajes. */
  readonly mensajes: string[];

  constructor(statusCode: number, error: string, mensajes: string[]) {
    super(mensajes.length > 0 ? mensajes.join(' ') : MENSAJE_GENERICO);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.mensajes = mensajes;
  }
}

/** La petición no llegó al servidor o la conexión se cortó. */
export class NetworkError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('No se pudo conectar con el servidor.', options);
    this.name = 'NetworkError';
  }
}

/**
 * La respuesta fue 2xx pero su cuerpo no cumple el contrato. Es un error
 * distinto para que una desviación del servidor no se muestre como un error
 * del usuario ni se use como dato.
 */
export class ContratoError extends Error {
  readonly detalle: ZodError;

  constructor(detalle: ZodError) {
    super('La respuesta del servidor no cumple el contrato esperado.');
    this.name = 'ContratoError';
    this.detalle = detalle;
  }
}

/**
 * Convierte una respuesta no exitosa en `ApiError`. Un cuerpo que no es JSON
 * (por ejemplo el HTML de un 502 de un proxy) o que no tiene la forma de Nest
 * produce igualmente un `ApiError` con el código HTTP y sin mensajes.
 */
export async function aApiError(respuesta: Response): Promise<ApiError> {
  const alternativo = respuesta.statusText || 'Error';
  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return new ApiError(respuesta.status, alternativo, []);
  }
  const analizado = cuerpoError.safeParse(cuerpo);
  if (!analizado.success) {
    return new ApiError(respuesta.status, alternativo, []);
  }
  const { error, message } = analizado.data;
  return new ApiError(
    respuesta.status,
    error,
    Array.isArray(message) ? message : [message],
  );
}
