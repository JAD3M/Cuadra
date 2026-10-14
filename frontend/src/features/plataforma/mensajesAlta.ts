import { ApiError, mensajeDeError } from '@/shared/api';
import { normalizarRfc, validarRfc } from '@/shared/dominio';
import { TEXTOS_ALTA_EMPRESA } from './textos';

/** Lo que se mandó, para poder explicar un 400 sin repetir texto del servidor. */
export interface DatosAlta {
  razonSocial: string;
  rfc: string;
}

/**
 * Fallo del alta ya convertido en texto: o va bajo un campo, o es una alerta.
 * `rfc` y `razonSocial` nombran qué campo se corrige.
 */
export type FalloAlta =
  | { donde: 'campo'; campo: 'rfc' | 'razonSocial'; texto: string }
  | { donde: 'alerta'; titulo: string; detalle?: string };

const LARGO_MAXIMO_RAZON = 255;

/**
 * Convierte el error del `POST /plataforma/empresas` en un fallo explicable.
 * Nunca muestra el texto del servidor: ante un 400 vuelve a clasificar lo
 * enviado con el espejo del RFC para decir qué campo y qué está mal; si ni
 * así se reconoce, cae en el mensaje general. 401 y 403 no se explican aquí:
 * los resuelve la pantalla terminando la sesión (`null`).
 */
export function describirFalloAlta(
  error: unknown,
  enviado: DatosAlta,
): FalloAlta | null {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return null;
    if (error.statusCode === 409) {
      return {
        donde: 'alerta',
        titulo: TEXTOS_ALTA_EMPRESA.duplicadoTitulo,
        detalle: TEXTOS_ALTA_EMPRESA.duplicadoDetalle,
      };
    }
    if (error.statusCode === 400) {
      const razon = enviado.razonSocial.trim();
      if (razon === '' || razon.length > LARGO_MAXIMO_RAZON) {
        return {
          donde: 'campo',
          campo: 'razonSocial',
          texto: TEXTOS_ALTA_EMPRESA.razonInvalida,
        };
      }
      const resultado = validarRfc(normalizarRfc(enviado.rfc));
      if (!resultado.valido) {
        return {
          donde: 'campo',
          campo: 'rfc',
          texto:
            resultado.motivo === 'generico'
              ? TEXTOS_ALTA_EMPRESA.rfcGenerico
              : TEXTOS_ALTA_EMPRESA.rfcFormato,
        };
      }
    }
  }
  const mensaje = mensajeDeError(error);
  if (!mensaje) return null;
  return { donde: 'alerta', titulo: mensaje.titulo, detalle: mensaje.detalle };
}
