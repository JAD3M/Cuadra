import { useRef, useState } from 'react';
import { ETIQUETAS_ROL, ordenarRoles, type Rol } from '@/shared/dominio';
import {
  useCancelarInvitacion,
  useReenviarInvitacion,
} from './useAccionInvitacionPendiente';
import { useCambiarRoles } from './useCambiarRoles';
import { useQuitarAcceso } from './useQuitarAcceso';
import { useUsuarios } from './useUsuarios';
import {
  ListaUsuarios,
  type AvisoFila,
  type FilaPersona,
} from './components/ListaUsuarios';
import {
  clasificarFalloAccionPendiente,
  clasificarFalloRoles,
  type ClaseFalloRoles,
  type FalloAccionPendiente,
} from './errores';
import {
  ALERTAS_INVITAR,
  ERROR_SIN_PERMISO,
  PERSONAS,
  ROLES_PERSONA,
  unirRoles,
} from './textos';
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

/**
 * Texto del fallo de cambiar roles o quitar acceso. Nunca sale del servidor.
 * El mockup no distingue el 404 (la persona ya no tiene roles en la empresa):
 * se muestra el fallo genérico de la acción.
 */
function textoDelFalloRoles(
  clase: ClaseFalloRoles,
  accion: 'cambiar' | 'quitar',
): string {
  switch (clase) {
    case 'ultimo_admin':
      return ROLES_PERSONA.ultimoAdmin;
    case 'permiso':
      return ERROR_SIN_PERMISO.titulo;
    case 'limite':
      return ALERTAS_INVITAR.limite.titulo;
    case 'conexion':
      return ALERTAS_INVITAR.conexion.titulo;
    case 'no_encontrada':
    case 'otro':
      return accion === 'cambiar'
        ? ROLES_PERSONA.errorGuardar
        : ROLES_PERSONA.errorQuitar;
  }
}

export interface ListaUsuariosContenedorProps {
  /** `usuarios.gestionar`: sin ella la lista es de solo lectura. */
  puedeGestionar: boolean;
}

/**
 * Junta la lista de personas de la empresa, reenviar y cancelar con su estado de fila, y (2.6) cambiar roles y quitar acceso. El
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
  const cambiar = useCambiarRoles();
  const quitar = useQuitarAcceso();
  const enVuelo = useRef(false);
  const [avisos, setAvisos] = useState<Record<string, AvisoFila>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [editando, setEditando] = useState<{
    id: string;
    roles: readonly Rol[];
  } | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ultimoExito, setUltimoExito] = useState<{ email: string } | null>(
    null,
  );
  const [aviso, setAviso] = useState<{ texto: string } | null>(null);
  const [ultimoFallo, setUltimoFallo] = useState<{ email: string } | null>(
    null,
  );

  const ocupado =
    reenviar.isPending ||
    cancelar.isPending ||
    cambiar.isPending ||
    quitar.isPending;

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
    setEditando(null);
    setQuitando(null);
    return true;
  }

  /**
   * Como `empezar`, pero deja abierto el editor o la confirmación: si la
   * acción falla (último administrador, error) la persona los sigue viendo.
   */
  function empezarSinCerrar(): boolean {
    if (enVuelo.current) return false;
    enVuelo.current = true;
    setAvisos({});
    setAviso(null);
    return true;
  }

  function cerrarAbiertos() {
    setConfirmando(null);
    setEditando(null);
    setQuitando(null);
  }

  function fallarRoles(
    email: string,
    error: unknown,
    accion: 'cambiar' | 'quitar',
  ) {
    const clase = clasificarFalloRoles(error);
    if (clase === null) return;
    setAvisos({
      [email]: { tipo: 'error', texto: textoDelFalloRoles(clase, accion) },
    });
    setUltimoFallo({ email });
  }

  function quitarAcceso(fila: FilaPersona) {
    if (!empezarSinCerrar()) return;
    quitar.mutate(fila.id, {
      onSuccess: () => {
        cerrarAbiertos();
        setAviso({ texto: ROLES_PERSONA.accesoQuitado(fila.email) });
      },
      onError: (error) => fallarRoles(fila.email, error, 'quitar'),
      onSettled: () => {
        enVuelo.current = false;
      },
    });
  }

  /** Con el borrador vacío «Guardar» es quitar acceso, no un PATCH. */
  function alGuardarRoles(fila: FilaPersona) {
    if (editando === null || editando.id !== fila.id) return;
    if (editando.roles.length === 0) {
      quitarAcceso(fila);
      return;
    }
    if (!empezarSinCerrar()) return;
    cambiar.mutate(
      { id: fila.id, roles: ordenarRoles(editando.roles) },
      {
        onSuccess: (respuesta) => {
          cerrarAbiertos();
          const etiquetas = ordenarRoles(respuesta.roles).map(
            (r) => ETIQUETAS_ROL[r],
          );
          setAvisos({
            [fila.email]: {
              tipo: 'ok',
              texto: ROLES_PERSONA.rolesGuardados(
                fila.email,
                unirRoles(etiquetas),
              ),
            },
          });
          setUltimoExito({ email: fila.email });
        },
        onError: (error) => fallarRoles(fila.email, error, 'cambiar'),
        onSettled: () => {
          enVuelo.current = false;
        },
      },
    );
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
      editando={editando}
      quitando={quitando}
      ocupado={ocupado}
      aviso={aviso}
      ultimoFallo={ultimoFallo}
      ultimoExito={ultimoExito}
      onReintentar={() => void lista.refetch()}
      onReenviar={alReenviar}
      onPedirCancelar={(fila) => {
        setAvisos({});
        setAviso(null);
        cerrarAbiertos();
        setConfirmando(fila.id);
      }}
      onConfirmarCancelar={alConfirmarCancelar}
      onVolver={() => setConfirmando(null)}
      onPedirEditar={(fila) => {
        setAvisos({});
        setAviso(null);
        cerrarAbiertos();
        setEditando({ id: fila.id, roles: fila.roles });
      }}
      onAlternarRol={(rol) =>
        setEditando((actual) =>
          actual === null
            ? null
            : {
                ...actual,
                roles: actual.roles.includes(rol)
                  ? actual.roles.filter((r) => r !== rol)
                  : [...actual.roles, rol],
              },
        )
      }
      onGuardarRoles={alGuardarRoles}
      onCancelarEdicion={() => setEditando(null)}
      onPedirQuitar={(fila) => {
        setAvisos({});
        setAviso(null);
        cerrarAbiertos();
        setQuitando(fila.id);
      }}
      onConfirmarQuitar={quitarAcceso}
      onVolverQuitar={() => setQuitando(null)}
    />
  );
}
