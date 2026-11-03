import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  bancoPlataforma,
  type BancoPlataforma,
} from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `POST /plataforma/bancos/:banco/levantar-vista-previa`. Quien decide si hay
 * evidencia suficiente es el servidor (422). Al levantarse, la lista se vuelve
 * a pedir para que el estado salga del servidor y no de una suposición.
 */
export function useLevantarVistaPrevia() {
  const cliente = useQueryClient();
  return useMutation<BancoPlataforma, unknown, string>({
    gcTime: 0,
    mutationFn: (banco) =>
      api.fetch(
        `/plataforma/bancos/${encodeURIComponent(banco)}/levantar-vista-previa`,
        {
          method: 'POST',
          schema: bancoPlataforma,
          terminaSesion: false,
        },
      ),
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: [CLAVE_PLATAFORMA, 'bancos'] }),
  });
}
