import { ETIQUETAS_ROL, type Rol } from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { CONFIRMACION, FORMULARIO } from '@/features/usuarios/textos';
import estilos from './ConfirmacionInvitacion.module.css';

export interface ConfirmacionInvitacionProps {
  /** Correo tal como lo escribió quien invita; nunca se toma de la respuesta. */
  email: string;
  /** Roles que se eligieron, ya en el orden del espejo. */
  roles: readonly Rol[];
  onOtra(): void;
}

/**
 * Confirmación de invitar (mockup `Usuarios.dc.html`, vista `exito`). El texto
 * es el mismo exista o no la cuenta del correo: no revela cuentas.
 */
export function ConfirmacionInvitacion({
  email,
  roles,
  onOtra,
}: ConfirmacionInvitacionProps) {
  return (
    <div className={estilos.tarjeta}>
      <h2 className={estilos.titulo}>{FORMULARIO.titulo}</h2>
      <div role="status" className={estilos.aviso}>
        <strong className={estilos.mensaje}>{CONFIRMACION.titulo}</strong>
        <dl className={estilos.datos}>
          <dt className={estilos.termino}>{CONFIRMACION.correo}</dt>
          <dd className={estilos.correo}>{email}</dd>
          <dt className={estilos.termino}>{CONFIRMACION.roles}</dt>
          <dd className={estilos.roles}>
            {roles.map((rol) => (
              <span key={rol} className={estilos.chip}>
                {ETIQUETAS_ROL[rol]}
              </span>
            ))}
          </dd>
        </dl>
        <span className={estilos.vigencia}>{FORMULARIO.vigencia}</span>
      </div>
      <Button
        type="button"
        variante="secundario"
        className={estilos.otra}
        onClick={onOtra}
      >
        {CONFIRMACION.otra}
      </Button>
    </div>
  );
}
