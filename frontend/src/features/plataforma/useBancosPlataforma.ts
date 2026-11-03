import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { listaBancosPlataforma } from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `GET /plataforma/bancos`: cada banco con sus cargas aceptadas, el mínimo que
 * pide el servidor y si su vista previa ya se levantó.
 */
export function useBancosPlataforma() {
  return useQuery({
    queryKey: [CLAVE_PLATAFORMA, 'bancos'],
    queryFn: () =>
      api.fetch('/plataforma/bancos', {
        schema: listaBancosPlataforma,
        terminaSesion: false,
      }),
  });
}
