import type { ZodType } from 'zod';
import { ContratoError, NetworkError, aApiError } from '@/shared/api/errores';

/** Por qué terminó la sesión; CU-21 decide qué hace la aplicación con cada uno. */
export type MotivoFinSesion = 'sin_acceso' | 'sesion_expirada';

export interface ConfiguracionCliente {
  /**
   * Época de la sesión viva, o `null` si no hay una. La sesión viaja en una
   * cookie `httpOnly` que el cliente no ve: este contador solo sirve para
   * saber si un 401 pertenece a la sesión actual o a una anterior.
   */
  proveedorEpoca?: () => number | null;
  /**
   * Se invoca con un 403 en `GET /auth/contexto` (`sin_acceso`) y con un 401 en
   * una llamada de la sesión viva (`sesion_expirada`). Inerte si no se
   * registra.
   */
  alTerminarSesion?: (motivo: MotivoFinSesion) => void;
}

export interface OpcionesCliente extends ConfiguracionCliente {
  /** Base relativa de las rutas. Nunca un origen absoluto. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface OpcionesApi<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /**
   * Un `FormData` se envía tal cual, sin `Content-Type`: el navegador fija el
   * multipart con su frontera. Cualquier otro valor se envía como JSON.
   */
  body?: unknown;
  /** Si se da, la respuesta se valida y un fallo es `ContratoError`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  /**
   * `false` marca una llamada del propio flujo de acceso (login, elegir
   * empresa, logout, restaurar): su 401 lo resuelve quien llama y no termina
   * la sesión viva.
   */
  terminaSesion?: boolean;
}

export interface ClienteApi {
  fetch<T = unknown>(path: string, opciones?: OpcionesApi<T>): Promise<T>;
  /** Reemplaza solo los hooks indicados (CU-21 los registra una vez). */
  configurar(configuracion: ConfiguracionCliente): void;
}

const RUTA_CONTEXTO = '/auth/contexto';
// Esquema (`https:`, `mailto:`) o ruta de protocolo relativo (`//host`).
const RUTA_NO_RELATIVA = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function validarRuta(path: string): void {
  // La cookie de sesión viaja con cada petición: una ruta absoluta la enviaría a otro origen.
  if (!path.startsWith('/') || RUTA_NO_RELATIVA.test(path)) {
    throw new TypeError(
      `La ruta de la API debe ser relativa y empezar con "/": ${path}`,
    );
  }
}

function sinConsulta(path: string): string {
  const corte = path.search(/[?#]/);
  return corte === -1 ? path : path.slice(0, corte);
}

export function crearClienteApi(opciones: OpcionesCliente = {}): ClienteApi {
  const baseUrl = (opciones.baseUrl ?? '/api').replace(/\/+$/, '');
  // Se resuelve en cada llamada para no capturar un `fetch` que luego se parchea.
  const fetchImpl: typeof fetch =
    opciones.fetchImpl ?? ((entrada, init) => globalThis.fetch(entrada, init));
  let proveedorEpoca = opciones.proveedorEpoca;
  let alTerminarSesion = opciones.alTerminarSesion;

  async function llamar<T>(path: string, o: OpcionesApi<T> = {}): Promise<T> {
    validarRuta(path);
    const method = o.method ?? 'GET';

    const headers = new Headers({ Accept: 'application/json' });
    // Solo una llamada de la sesión viva puede terminarla: las del flujo de
    // acceso (`terminaSesion: false`) resuelven su 401 por su cuenta.
    const epoca =
      o.terminaSesion === false ? null : (proveedorEpoca?.() ?? null);
    let body: string | FormData | undefined;
    if (o.body instanceof FormData) {
      body = o.body;
    } else if (o.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(o.body);
    }

    let respuesta: Response;
    try {
      respuesta = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body,
        // La sesión es una cookie `httpOnly` del mismo origen (proxy de Vite).
        credentials: 'include',
        signal: o.signal,
      });
    } catch (causa) {
      // Una cancelación pedida por quien llama no es un fallo de red: se
      // propaga tal cual para que no dispare reintentos ni mensajes de error.
      if (o.signal?.aborted) throw causa;
      throw new NetworkError({ cause: causa });
    }

    if (!respuesta.ok) {
      const error = await aApiError(respuesta);
      if (
        respuesta.status === 403 &&
        method === 'GET' &&
        sinConsulta(path) === RUTA_CONTEXTO
      ) {
        alTerminarSesion?.('sin_acceso');
      } else if (
        respuesta.status === 401 &&
        epoca !== null &&
        // Si la época ya cambió (otro 401 terminó la sesión, o hubo un cambio
        // de empresa), este 401 es de una sesión anterior y se ignora.
        proveedorEpoca?.() === epoca
      ) {
        alTerminarSesion?.('sesion_expirada');
      }
      throw error;
    }

    const texto = await respuesta.text();
    let datos: unknown;
    if (texto !== '') {
      try {
        datos = JSON.parse(texto);
      } catch (causa) {
        throw new ContratoError(undefined, { cause: causa });
      }
    }
    if (!o.schema) return datos as T;
    const analizado = o.schema.safeParse(datos);
    if (!analizado.success) throw new ContratoError(analizado.error);
    return analizado.data;
  }

  return {
    fetch: llamar,
    configurar(configuracion) {
      if ('proveedorEpoca' in configuracion)
        proveedorEpoca = configuracion.proveedorEpoca;
      if ('alTerminarSesion' in configuracion)
        alTerminarSesion = configuracion.alTerminarSesion;
    },
  };
}

/** Cliente único de la aplicación. CU-21 lo configura con `configurarCliente`. */
export const api = crearClienteApi();

export function configurarCliente(configuracion: ConfiguracionCliente): void {
  api.configurar(configuracion);
}
