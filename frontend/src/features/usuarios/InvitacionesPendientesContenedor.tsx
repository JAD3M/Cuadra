import { useRef, useState } from 'react';
import { ordenarRoles } from '@/shared/dominio';
import {
  useCancelarInvitacion,
  useReenviarInvitacion,
} from './useAccionInvitacionPendiente';
import { useInvitacionesPendientes } from './useInvitacionesPendientes';
import {
  InvitacionesPendientes,
  type AvisoFila,
  type FilaPendiente,
} from './components/InvitacionesPendientes';
import {
  clasificarFalloAccionPendiente,
  type FalloAccionPendiente,
} from './errores';
import { ALERTAS_INVITAR, ERROR_SIN_PERMISO, PENDIENTES } from './textos';
import { textoEnviada, textoVence } from './vencimiento';

function textoDelFallo(fallo: FalloAccionPendiente): string {
  switch (fallo.clase) {
    case 'no_pendiente':
      return fallo.mensaje ?? PENDIENTES.noPendiente;
    case 'permiso':
      return ERROR_SIN_PERMISO.titulo;
    case 'limite':
      return ALERTAS_INVITAR.limite.titulo;
    case 'envio':
      return ALERTAS_INVITAR.envio.titulo;
    case 'conexion':
      return ALERTAS_INVITAR.conexion.titulo;
    case 'otro':
      return ALERTAS_INVITAR.otro.titulo;
  }
}

export interface InvitacionesPendientesContenedorProps {
  /** `usuarios.gestionar`: sin ella la lista es de solo lectura. */
  puedeGestionar: boolean;
}

/**
 * Junta la lista de pendientes, reenviar y cancelar con su estado de fila. El
 * servidor decide si la persona puede y si la invitación sigue pendiente; aquí
 * solo se muestra lo que respondió. Los avisos se guardan por correo porque
 * reenviar reemplaza la fila (id nuevo). Una acción nueva retira todos los
 * avisos anteriores; el 409 y el 404 no vuelven a pedir la lista, para que la
 * fila y su aviso sigan a la vista.
 */
export function InvitacionesPendientesContenedor({
  puedeGestionar,
}: InvitacionesPendientesContenedorProps) {
  const lista = useInvitacionesPendientes(true);
  const reenviar = useReenviarInvitacion();
  const cancelar = useCancelarInvitacion();
  const enVuelo = useRef(false);
  const [avisos, setAvisos] = useState<Record<string, AvisoFila>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string } | null>(null);
  const [ultimoFallo, setUltimoFallo] = useState<{ email: string } | null>(
    null,
  );

  const ocupado = reenviar.isPending || cancelar.isPending;

  const filas: FilaPendiente[] = (lista.data ?? []).map((i) => {
    const vence = textoVence(i.venceEn, i.vencida);
    return {
      id: i.id,
      email: i.email,
      roles: ordenarRoles(i.roles),
      enviada: textoEnviada(i.creadaEn),
      vence: vence.texto,
      vencida: vence.vencida,
      invitadaPor: i.invitadaPor,
    };
  });

  let estado: 'cargando' | 'vacio' | 'error' | 'filas';
  if (lista.isPending && !lista.isError) estado = 'cargando';
  else if (lista.isError && lista.data === undefined) estado = 'error';
  else estado = filas.length === 0 ? 'vacio' : 'filas';

  function empezar(): boolean {
    if (enVuelo.current) return false;
    enVuelo.current = true;
    setAvisos({});
    setAviso(null);
    setConfirmando(null);
    return true;
  }

  function fallar(email: string, error: unknown) {
    const fallo = clasificarFalloAccionPendiente(error);
    if (fallo === null) return;
    setAvisos({ [email]: { tipo: 'error', texto: textoDelFallo(fallo) } });
    setUltimoFallo({ email });
  }

  function alReenviar(fila: FilaPendiente) {
    if (!empezar()) return;
    reenviar.mutate(fila.id, {
      onSuccess: () =>
        setAvisos({
          [fila.email]: { tipo: 'ok', texto: PENDIENTES.reenviada(fila.email) },
        }),
      onError: (error) => fallar(fila.email, error),
      onSettled: () => {
        enVuelo.current = false;
      },
    });
  }

  function alConfirmarCancelar(fila: FilaPendiente) {
    if (!empezar()) return;
    cancelar.mutate(fila.id, {
      onSuccess: () => setAviso({ texto: PENDIENTES.cancelada(fila.email) }),
      onError: (error) => fallar(fila.email, error),
      onSettled: () => {
        enVuelo.current = false;
      },
    });
  }

  return (
    <InvitacionesPendientes
      estado={estado}
      filas={filas}
      puedeGestionar={puedeGestionar}
      avisos={avisos}
      confirmando={confirmando}
      ocupado={ocupado}
      aviso={aviso}
      ultimoFallo={ultimoFallo}
      onReintentar={() => void lista.refetch()}
      onReenviar={alReenviar}
      onPedirCancelar={(fila) => {
        setAvisos({});
        setAviso(null);
        setConfirmando(fila.id);
      }}
      onConfirmarCancelar={alConfirmarCancelar}
      onVolver={() => setConfirmando(null)}
    />
  );
}
