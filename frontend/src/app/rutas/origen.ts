import type { Location } from 'react-router';
import { destinoSeguro, type DestinoGuardado } from '@/shared/sesion';

/**
 * La ubicación actual como destino de retorno, ya validada. Se vuelve a
 * validar al leerlo; aquí solo se evita guardar lo que nunca se aceptaría
 * (p. ej. `/empresa`).
 */
export function origenDe(ubicacion: Location): DestinoGuardado | null {
  return destinoSeguro({
    pathname: ubicacion.pathname,
    search: ubicacion.search,
    hash: ubicacion.hash,
  });
}
