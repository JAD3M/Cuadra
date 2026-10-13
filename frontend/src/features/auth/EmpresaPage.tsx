import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import {
  PasoEmpresa,
  type FalloEmpresa,
} from '@/features/auth/components/PasoEmpresa';
import {
  saludoCambio,
  saludoEmpresas,
} from '@/features/auth/components/textos';
import { ApiError, mensajeDeError } from '@/shared/api';
import { useSessionActions, useSessionContext } from '@/shared/sesion';
import { ControlTema } from '@/shared/tema';

/**
 * Paso 2 del acceso (y del cambio de empresa). Contenedor: lee `selecting`,
 * llama a `elegirEmpresa` y deja que la sesión mande: al elegir bien el
 * estado pasa a `loading` y la guarda de `/empresa` redirige; con un 401 o una
 * lista que queda vacía, la sesión termina y la guarda lleva a `/login`.
 */
export function EmpresaPage() {
  const estado = useSessionContext();
  const { elegirEmpresa, volverAlInicio, regresarSinCambiar } =
    useSessionActions();
  const [fallo, setFallo] = useState<FalloEmpresa | null>(null);

  const eleccion = useMutation({
    gcTime: 0,
    mutationFn: (id: string) => elegirEmpresa(id),
    onMutate: () => setFallo(null),
    onError: (error) => {
      // Un 401 termina la sesión: el cambio de estado redirige y no hay
      // nada que mostrar aquí.
      if (error instanceof ApiError && error.statusCode === 401) return;
      // Con un 403 `elegirEmpresa` ya refrescó la lista; solo falta el aviso.
      setFallo(mensajeDeError(error, 'seleccion'));
    },
  });

  // La guarda solo monta esta pantalla en `selecting`.
  if (estado.status !== 'selecting') return null;

  const cambio = estado.origen === 'cambio';
  const saludo = cambio
    ? saludoCambio(estado.empresaActual?.razonSocial)
    : saludoEmpresas(estado.usuario?.nombre ?? '', estado.empresas.length);

  return (
    <LayoutAuth controlTema={<ControlTema />}>
      <PasoEmpresa
        saludo={saludo}
        empresas={estado.empresas}
        pendienteId={eleccion.isPending ? eleccion.variables : null}
        fallo={eleccion.isPending ? null : fallo}
        textoVolver={
          cambio ? '← Volver sin cambiar de empresa' : '← Cambiar de cuenta'
        }
        enfocarTitulo
        onElegir={(id) => eleccion.mutate(id)}
        onVolver={cambio ? regresarSinCambiar : volverAlInicio}
      />
    </LayoutAuth>
  );
}
