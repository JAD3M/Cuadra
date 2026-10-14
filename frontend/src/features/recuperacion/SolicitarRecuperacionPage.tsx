import { useState } from 'react';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import { mensajeDeError } from '@/shared/api';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { EstadoTerminalRecuperacion } from './components/EstadoTerminalRecuperacion';
import { FormularioSolicitar } from './components/FormularioSolicitar';
import { useSolicitarRecuperacion } from './useSolicitarRecuperacion';

/**
 * Página pública `/recuperar`. Contenedor: manda el correo a la API y, si
 * respondió, muestra siempre «Revisa tu correo»: la respuesta es la misma
 * exista o no la cuenta. Solo un fallo de red, el límite o un 5xx muestran
 * una alerta y conservan el formulario. Anónima, sin guarda.
 */
export function SolicitarRecuperacionPage() {
  const solicitar = useSolicitarRecuperacion();
  const [enviado, setEnviado] = useState(false);
  const [alerta, setAlerta] = useState<{
    titulo: string;
    detalle?: string;
  } | null>(null);

  const contenido = enviado ? (
    <EstadoTerminalRecuperacion estado="enviado" />
  ) : (
    <FormularioSolicitar
      pendiente={solicitar.isPending}
      aviso={
        alerta && <AlertaError titulo={alerta.titulo} detalle={alerta.detalle} />
      }
      onEnviar={(valores) => {
        setAlerta(null);
        solicitar.mutate(valores, {
          onSuccess: () => setEnviado(true),
          onError: (error) => {
            const mensaje = mensajeDeError(error);
            if (mensaje)
              setAlerta({ titulo: mensaje.titulo, detalle: mensaje.detalle });
          },
        });
      }}
    />
  );

  return <LayoutAuth controlTema={<ControlTema />}>{contenido}</LayoutAuth>;
}
