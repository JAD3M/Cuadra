import { QueryClient } from '@tanstack/react-query';
import { ApiError, ContratoError } from '@/shared/api/errores';

const REINTENTOS_MAXIMOS = 2;

/**
 * Política de reintentos de las consultas. Un 4xx lo causó la petición y
 * repetirla da lo mismo; un fallo de contrato es determinista. Solo se
 * reintentan los fallos de red y los 5xx, hasta dos veces.
 */
export function reintentarConsulta(intentos: number, error: unknown): boolean {
  if (intentos >= REINTENTOS_MAXIMOS) return false;
  if (error instanceof ContratoError) return false;
  if (error instanceof ApiError) return error.statusCode >= 500;
  return true;
}

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: reintentarConsulta,
        refetchOnWindowFocus: false,
      },
      // Una mutación (login, canje de token) no es segura de repetir sola.
      mutations: { retry: false },
    },
  });
}
