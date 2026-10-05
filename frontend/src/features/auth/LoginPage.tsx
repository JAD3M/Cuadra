import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { AvisoAuth } from '@/features/auth/components/AvisoAuth';
import {
  FormularioLogin,
  type FalloLogin,
} from '@/features/auth/components/FormularioLogin';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import { textoAviso } from '@/features/auth/components/textos';
import type { ValoresLogin } from '@/features/auth/esquemaLogin';
import { mensajeDeError } from '@/shared/api';
import {
  estadoAcceso,
  useSessionActions,
  useSessionContext,
  type MotivoSalida,
  type SessionState,
} from '@/shared/sesion';
import { ControlTema } from '@/shared/tema';

/** Salidas tras las que se vuelve a escribir la contraseña con el correo ya puesto. */
const MOTIVOS_CON_CORREO: readonly MotivoSalida[] = [
  'reingreso',
  'seleccion_vencida',
  'sin_empresas',
];

interface SalidaLeida {
  motivo: MotivoSalida;
  email?: string;
}

function leerSalida(estado: SessionState): SalidaLeida | null {
  return estado.status === 'ended'
    ? { motivo: estado.motivo, email: estado.email }
    : null;
}

/**
 * Paso 1 del acceso. Contenedor: lee la sesión y llama a `iniciarSesion`; el
 * formulario solo recibe props. No navega: al iniciar sesión el estado pasa a
 * `selecting` y la guarda de `/login` redirige.
 *
 * El motivo de una sesión terminada y su correo se leen una vez, al montar, a
 * estado local, y entonces se llama a `consumirFin`: el aviso sale una sola
 * vez y no reaparece en una visita posterior.
 */
export function LoginPage() {
  const estado = useSessionContext();
  const { iniciarSesion, consumirFin } = useSessionActions();
  const { state } = useLocation();
  const [salida] = useState(() => leerSalida(estado));
  const [fallo, setFallo] = useState<FalloLogin | null>(null);

  useEffect(() => {
    if (estado.status === 'ended') consumirFin();
  }, [estado.status, consumirFin]);

  // La contraseña viaja en las variables de la mutación; se sueltan de la
  // caché apenas termina, con éxito o con fallo (gcTime 0 las descarta).
  const reiniciar = useRef<() => void>(() => {});
  const acceso = useMutation({
    gcTime: 0,
    mutationFn: (valores: ValoresLogin) => iniciarSesion(valores),
    onError: (error) => setFallo(mensajeDeError(error, 'login')),
    onSettled: () => reiniciar.current(),
  });
  useEffect(() => {
    reiniciar.current = acceso.reset;
  });

  const aviso = salida ? textoAviso(salida.motivo) : null;
  const correo =
    salida && MOTIVOS_CON_CORREO.includes(salida.motivo)
      ? salida.email
      : undefined;
  const enfocarCorreo = estadoAcceso(state).foco === 'correo' && !aviso;

  return (
    <LayoutAuth controlTema={<ControlTema />}>
      <FormularioLogin
        correoInicial={correo}
        pendiente={acceso.isPending}
        fallo={acceso.isPending ? null : fallo}
        enfocarCorreo={enfocarCorreo}
        aviso={aviso ? <AvisoAuth enfocar>{aviso}</AvisoAuth> : undefined}
        onEnviar={(valores) => {
          setFallo(null);
          acceso.mutate(valores);
        }}
      />
    </LayoutAuth>
  );
}
