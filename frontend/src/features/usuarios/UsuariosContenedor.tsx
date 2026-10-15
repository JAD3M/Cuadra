import { useState } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { ordenarRoles, puede, type Rol } from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { ConfirmacionInvitacion } from './components/ConfirmacionInvitacion';
import { FormularioInvitarUsuario } from './components/FormularioInvitarUsuario';
import { InvitacionesPendientesContenedor } from './InvitacionesPendientesContenedor';
import { clasificarFalloInvitar, type ClaseFalloInvitar } from './errores';
import { ERROR_SIN_PERMISO } from './textos';
import estilos from './UsuariosContenedor.module.css';
import { useInvitarUsuario } from './useInvitarUsuario';

// Comodidad del navegador; quien decide si el correo vale es el servidor.
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Enviada {
  email: string;
  roles: Rol[];
}

/**
 * Contenedor de la pantalla de Usuarios: el formulario de invitar (con la
 * capacidad `usuarios.gestionar`), la lista de invitaciones pendientes (con
 * `usuarios.ver`; reenviar y cancelar piden `usuarios.gestionar`) o el aviso
 * de sin permiso. Es el único
 * sitio que junta la sesión, el hook y el estado; los componentes solo
 * reciben props. Mostrar u ocultar es comodidad: el servidor decide y
 * responde 403.
 *
 * Estado propio: el borrador (correo y roles), lo que falló en el navegador,
 * la confirmación y el último fallo del servidor. Editar quita el fallo.
 * Todo lo que muestra la confirmación es lo que la persona escribió, nunca la
 * respuesta: no se deriva nada de ella.
 */
export function UsuariosContenedor() {
  const sesion = useSessionContext();
  const { mutate, isPending } = useInvitarUsuario();
  const [correo, setCorreo] = useState('');
  const [roles, setRoles] = useState<Rol[]>([]);
  const [correoInvalido, setCorreoInvalido] = useState(false);
  const [rolesVacios, setRolesVacios] = useState(false);
  const [enviada, setEnviada] = useState<Enviada | null>(null);
  // Objeto nuevo en cada fallo: dos seguidos de la misma clase llevan otra
  // vez el foco a la alerta.
  const [fallo, setFallo] = useState<{ clase: ClaseFalloInvitar } | null>(null);

  // La ruta ya exige sesión lista; si no lo está no hay capacidades que juzgar.
  if (sesion.status !== 'ready') return null;

  const puedeGestionar = puede(
    sesion.contexto.capacidades,
    'usuarios.gestionar',
  );
  const puedeVer = puede(sesion.contexto.capacidades, 'usuarios.ver');
  const sinPermiso =
    (!puedeGestionar && !puedeVer) || fallo?.clase === 'permiso';

  if (sinPermiso) {
    return (
      <section aria-label="Sin permiso" className={estilos.contenedor}>
        <AlertaError {...ERROR_SIN_PERMISO} />
      </section>
    );
  }

  const pendientes = puedeVer && (
    <InvitacionesPendientesContenedor puedeGestionar={puedeGestionar} />
  );

  if (enviada !== null) {
    return (
      <div className={estilos.columna}>
        <section className={estilos.contenedor}>
          <ConfirmacionInvitacion
            email={enviada.email}
            roles={enviada.roles}
            onOtra={() => setEnviada(null)}
          />
        </section>
        {pendientes}
      </div>
    );
  }

  function alEscribirCorreo(texto: string) {
    setCorreo(texto);
    setCorreoInvalido(false);
    setFallo(null);
  }

  function alAlternarRol(valor: Rol) {
    setRoles((actuales) =>
      actuales.includes(valor)
        ? actuales.filter((r) => r !== valor)
        : [...actuales, valor],
    );
    setRolesVacios(false);
    setFallo(null);
  }

  function alEnviar() {
    if (isPending) return;
    const limpio = correo.trim();
    const sinForma = !FORMA_DE_CORREO.test(limpio);
    const sinRoles = roles.length === 0;
    setCorreoInvalido(sinForma);
    setRolesVacios(sinRoles);
    if (sinForma || sinRoles) return;
    setFallo(null);
    const solicitud = { email: limpio, roles: ordenarRoles(roles) };
    mutate(solicitud, {
      onSuccess: () => {
        setEnviada({ email: solicitud.email, roles: solicitud.roles });
        setCorreo('');
        setRoles([]);
        setCorreoInvalido(false);
        setRolesVacios(false);
      },
      onError: (error) => {
        const clase = clasificarFalloInvitar(error);
        setFallo(clase === null ? null : { clase });
      },
    });
  }

  const claseFallo = fallo?.clase;
  const formulario = (
    <section className={estilos.contenedor}>
      <FormularioInvitarUsuario
        correo={correo}
        roles={roles}
        errorCorreo={correoInvalido || claseFallo === 'correo'}
        errorRoles={rolesVacios}
        fallo={
          claseFallo === undefined ||
          claseFallo === 'correo' ||
          claseFallo === 'permiso'
            ? null
            : { clase: claseFallo }
        }
        pendiente={isPending}
        onCambiarCorreo={alEscribirCorreo}
        onAlternarRol={alAlternarRol}
        onEnviar={alEnviar}
      />
    </section>
  );
  return (
    <div className={estilos.columna}>
      {puedeGestionar && formulario}
      {pendientes}
    </div>
  );
}
