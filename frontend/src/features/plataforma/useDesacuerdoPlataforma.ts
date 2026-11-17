import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { listaDesacuerdoPlataforma } from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `GET /plataforma/desacuerdo` (historia 9.2): la tasa de desacuerdo por empresa
 * y banco, con sus conteos. La tasa viaja como texto.
 */
export function useDesacuerdoPlataforma() {
  return useQuery({
    queryKey: [CLAVE_PLATAFORMA, 'desacuerdo'],
    queryFn: () =>
      api.fetch('/plataforma/desacuerdo', {
        schema: listaDesacuerdoPlataforma,
        terminaSesion: false,
      }),
  });
}
