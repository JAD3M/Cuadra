import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { condicionCierrePlataforma } from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `GET /plataforma/condicion-cierre` (historia 9.5): si los datos de todas las
 * empresas cumplen la condición para considerar el cierre automático. El
 * servidor la calcula en cada consulta; las tasas viajan como texto.
 */
export function useCondicionCierrePlataforma() {
  return useQuery({
    queryKey: [CLAVE_PLATAFORMA, 'condicion-cierre'],
    queryFn: () =>
      api.fetch('/plataforma/condicion-cierre', {
        schema: condicionCierrePlataforma,
        terminaSesion: false,
      }),
  });
}
