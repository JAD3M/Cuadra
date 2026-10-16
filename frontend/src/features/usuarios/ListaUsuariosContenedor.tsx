import { useRef, useState } from 'react';
import { ordenarRoles } from '@/shared/dominio';
import {
  useCancelarInvitacion,
  useReenviarInvitacion,
} from './useAccionInvitacionPendiente';
import { useUsuarios } from './useUsuarios';
import {
  ListaUsuarios,
  type AvisoFila,
  type FilaPersona,
} from './components/ListaUsuarios';
import {
  clasificarFalloAccionPendiente,
  type FalloAccionPendiente,
} from './errores';
import { ALERTAS_INVITAR, ERROR_SIN_PERMISO, PERSONAS } from './textos';
import { textoEnviada, textoVence } from './vencimiento';

function textoDelFallo(fallo: FalloAccionPendiente): string {
  switch (fallo.clase) {
    case 'no_pendiente':
      return fallo.mensaje ?? PERSONAS.noPendiente;
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

export interface ListaUsuariosContenedorProps {
  /** `usuarios.gestionar`: sin ella la lista es de solo lectura. */
  puedeGestionar: boolean;
}

/**
 * Junta la lista de personas de la empresa, reenviar y cancelar con su estado de fila. El
 * servidor decide si la persona puede y si la invitación sigue pendiente; aquí
 * solo se muestra lo que respondió. Los avisos se guardan por correo porque
 * reenviar reemplaza la fila (id nuevo). Una acción nueva retira todos los
 * avisos anteriores; el 409 y el 404 no vuelven a pedir la lista, para que la
 * fila y su aviso sigan a la vista.
 */
export function ListaUsuariosContenedor({
  puedeGestionar,
}: ListaUsuariosContenedorProps) {
  const lista = useUsuarios(true);
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

  const filas: FilaPersona[] = (lista.data ?? []).map((p) => {
    const roles = ordenarRoles(p.roles);
    if (p.estado === 'activo' || p.invitacionId === null) {
      return {
        id: p.id,
        email: p.email,
        roles,
        estado: 'activo',
        invitacionId: null,
        estadoTexto: PERSONAS.activo,
        vencida: false,
        enviada: null,
        invitadaPor: null,
      };
    }
    const vence = textoVence(p.venceEn ?? '', p.vencida);
    return {
      id: p.id,
      email: p.email,
      roles,
      estado: 'pendiente',
      invitacionId: p.invitacionId,
      estadoTexto: vence.texto,
      vencida: vence.vencida,
      enviada: p.creadaEn === null ? null : textoEnviada(p.creadaEn),
      invitadaPor: p.invitadaPor,
    };
  });

  let estado: 'cargando' | 'error' | 'filas';
  if (lista.isPending && !lista.isError) estado = 'cargando';
  else if (lista.isError && lista.data === undefined) estado = 'error';
  else estado = 'filas';

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

  function alReenviar(fila: FilaPersona) {
    if (fila.invitacionId === null || !empezar()) return;
    reenviar.mutate(fila.invitacionId, {
      onSuccess: () =>
        setAvisos({
          [fila.email]: { tipo: 'ok', texto: PERSONAS.reenviada(fila.email) },
        }),
      onError: (error) => fallar(fila.email, error),
      onSettled: () => {
        enVuelo.current = false;
      },
    });
  }

  function alConfirmarCancelar(fila: FilaPersona) {
    if (fila.invitacionId === null || !empezar()) return;
    cancelar.mutate(fila.invitacionId, {
      onSuccess: () => setAviso({ texto: PERSONAS.cancelada(fila.email) }),
      onError: (error) => fallar(fila.email, error),
      onSettled: () => {
        enVuelo.current = false;
      },
    });
  }

  return (
    <ListaUsuarios
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
