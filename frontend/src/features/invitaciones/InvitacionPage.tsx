import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AvisoAuth } from '@/features/auth/components/AvisoAuth';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import { ApiError, mensajeDeError } from '@/shared/api';
import { useSessionActions } from '@/shared/sesion';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { EstadoTerminalInvitacion } from './components/EstadoTerminalInvitacion';
import { FormularioAceptarInvitacion } from './components/FormularioAceptarInvitacion';
import type { ValoresCuentaNueva } from './esquemaAceptar';
import { TEXTOS_INVITACION, type MotivoTerminal } from './textos';
import { useAceptarInvitacion } from './useAceptarInvitacion';
import { useEstadoInvitacion } from './useEstadoInvitacion';

/**
 * Página pública `/invitacion/:token`. Contenedor: lee el estado del enlace y
 * acepta por la API; los componentes solo reciben props. No decide nada: el
 * servidor dice si el enlace vale, si hay que elegir contraseña y con qué
 * motivo se rechaza. Es anónima y no redirige aunque haya una sesión: aceptar
 * la reemplaza por la de la empresa nueva. El token vive solo en la URL.
 */
export function InvitacionPage() {
  const { token = '' } = useParams();
  const navegar = useNavigate();
  const { abrirSesionDeInvitacion } = useSessionActions();
  const estado = useEstadoInvitacion(token);
  const aceptar = useAceptarInvitacion(token);
  const [terminal, setTerminal] = useState<MotivoTerminal | null>(null);
  const [errorContrasena, setErrorContrasena] = useState<string | undefined>();
  const [alerta, setAlerta] = useState<{
    titulo: string;
    detalle?: string;
  } | null>(null);
  const [entrando, setEntrando] = useState(false);

  function enviar(valores: ValoresCuentaNueva | null) {
    setErrorContrasena(undefined);
    setAlerta(null);
    aceptar.mutate(valores ?? {}, {
      onSuccess: async () => {
        setEntrando(true);
        try {
          await abrirSesionDeInvitacion();
          void navegar('/bandeja', { replace: true });
        } catch {
          // La invitación ya se consumió y la sesión no se pudo abrir: lo
          // honesto es mandar a iniciar sesión.
          setEntrando(false);
          setTerminal('usada');
        }
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.statusCode === 400) {
            setErrorContrasena(TEXTOS_INVITACION.contrasenaCorta);
            return;
          }
          if (error.statusCode === 403)
            return setTerminal('sin_cuenta_inactiva');
          if (error.statusCode === 404) return setTerminal('desconocida');
          // 410: el enlace dejó de valer; se vuelve a leer para conocer el
          // motivo en vez de adivinarlo.
          if (error.statusCode === 410) return void estado.refetch();
        }
        const mensaje = mensajeDeError(error);
        if (mensaje)
          setAlerta({ titulo: mensaje.titulo, detalle: mensaje.detalle });
      },
    });
  }

  const datos = estado.data;
  let contenido;
  if (terminal) {
    contenido = <EstadoTerminalInvitacion motivo={terminal} />;
  } else if (datos?.estado === 'invalida') {
    contenido = <EstadoTerminalInvitacion motivo={datos.motivo} />;
  } else if (datos?.estado === 'vigente') {
    const cuentaNueva = datos.requierePassword;
    contenido = (
      <FormularioAceptarInvitacion
        key={cuentaNueva ? 'nueva' : 'existente'}
        empresa={datos.empresa}
        cuentaNueva={cuentaNueva}
        pendiente={aceptar.isPending || entrando}
        errorContrasena={errorContrasena}
        aviso={
          <>
            {!cuentaNueva && (
              <AvisoAuth>{TEXTOS_INVITACION.cuentaExistente}</AvisoAuth>
            )}
            {alerta && (
              <AlertaError titulo={alerta.titulo} detalle={alerta.detalle} />
            )}
          </>
        }
        onEnviar={enviar}
      />
    );
  } else if (estado.isError) {
    const mensaje = mensajeDeError(estado.error);
    contenido = mensaje ? (
      <AlertaError titulo={mensaje.titulo} detalle={mensaje.detalle} />
    ) : null;
  } else {
    contenido = <div aria-busy="true" />;
  }

  return <LayoutAuth controlTema={<ControlTema />}>{contenido}</LayoutAuth>;
}
