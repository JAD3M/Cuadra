import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { listaFraccionesPlataforma } from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `GET /plataforma/fracciones` (historia 9.2): por empresa, qué parte de sus
 * facturas son PPD y qué parte de sus movimientos son parcialidades o comisiones.
 */
export function useFraccionesPlataforma() {
  return useQuery({
    queryKey: [CLAVE_PLATAFORMA, 'fracciones'],
    queryFn: () =>
      api.fetch('/plataforma/fracciones', {
        schema: listaFraccionesPlataforma,
        terminaSesion: false,
      }),
  });
}
