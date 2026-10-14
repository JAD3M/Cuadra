import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  empresaCreadaPlataforma,
  type EmpresaPlataforma,
  type SolicitudCrearEmpresa,
} from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/**
 * `POST /plataforma/empresas`: da de alta una empresa. El RFC se manda tal
 * como lo escribió la persona (normalizado en el cliente solo por comodidad);
 * el servidor lo normaliza, lo valida y decide. Al crearse, la lista se vuelve
 * a pedir para que la fila nueva salga del servidor y no de una suposición.
 */
export function useCrearEmpresaPlataforma() {
  const cliente = useQueryClient();
  return useMutation<EmpresaPlataforma, unknown, SolicitudCrearEmpresa>({
    mutationFn: (cuerpo) =>
      api.fetch('/plataforma/empresas', {
        method: 'POST',
        body: cuerpo,
        schema: empresaCreadaPlataforma,
        terminaSesion: false,
      }),
    onSuccess: () =>
      cliente.invalidateQueries({ queryKey: [CLAVE_PLATAFORMA, 'empresas'] }),
  });
}
