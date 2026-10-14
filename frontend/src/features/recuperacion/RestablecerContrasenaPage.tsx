import { useState } from 'react';
import { useParams } from 'react-router';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import { ApiError, mensajeDeError } from '@/shared/api';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { EstadoTerminalRecuperacion } from './components/EstadoTerminalRecuperacion';
import { FormularioRestablecer } from './components/FormularioRestablecer';
import {
  TEXTOS_RECUPERACION,
  type EstadoTerminalRecuperacion as Terminal,
} from './textos';
import { useEstadoRecuperacion } from './useEstadoRecuperacion';
import { useRestablecerContrasena } from './useRestablecerContrasena';

/**
 * Página pública `/recuperar/:token`. Contenedor: lee el estado del enlace y
 * restablece por la API; no decide nada: el servidor dice si el enlace vale,
 * con qué motivo se rechaza y si la contraseña cumple. No abre sesión: al
 * terminar ofrece ir al login. Anónima y sin redirección aunque haya una
 * sesión viva. El token vive solo en la URL.
 */
export function RestablecerContrasenaPage() {
  const { token = '' } = useParams();
  const estado = useEstadoRecuperacion(token);
  const restablecer = useRestablecerContrasena(token);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [errorContrasena, setErrorContrasena] = useState<string | undefined>();
  const [alerta, setAlerta] = useState<{
    titulo: string;
    detalle?: string;
  } | null>(null);

  function enviar(password: string) {
    setErrorContrasena(undefined);
    setAlerta(null);
    restablecer.mutate(
      { password },
      {
        onSuccess: () => setTerminal('exito'),
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.statusCode === 400) {
              setErrorContrasena(TEXTOS_RECUPERACION.contrasenaCorta);
              return;
            }
            if (error.statusCode === 403)
              return setTerminal('cuenta_desactivada');
            if (error.statusCode === 404) return setTerminal('desconocida');
            // 410: el enlace dejó de valer; se vuelve a leer para conocer el
            // motivo en vez de adivinarlo.
            if (error.statusCode === 410) return void estado.refetch();
          }
          const mensaje = mensajeDeError(error);
          if (mensaje)
            setAlerta({ titulo: mensaje.titulo, detalle: mensaje.detalle });
        },
      },
    );
  }

  const datos = estado.data;
  let contenido;
  if (terminal) {
    contenido = <EstadoTerminalRecuperacion estado={terminal} />;
  } else if (datos?.estado === 'invalida') {
    contenido = <EstadoTerminalRecuperacion estado={datos.motivo} />;
  } else if (datos?.estado === 'vigente') {
    contenido = (
      <FormularioRestablecer
        pendiente={restablecer.isPending}
        errorContrasena={errorContrasena}
        aviso={
          alerta && (
            <AlertaError titulo={alerta.titulo} detalle={alerta.detalle} />
          )
        }
        onEnviar={(valores) => enviar(valores.password)}
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
