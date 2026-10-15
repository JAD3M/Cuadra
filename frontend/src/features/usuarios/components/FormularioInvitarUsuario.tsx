import { useEffect, useId, useRef } from 'react';
import type { FormEvent } from 'react';
import {
  DESCRIPCIONES_ROL,
  ETIQUETAS_ROL,
  ROLES,
  type Rol,
} from '@/shared/dominio';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import { ALERTAS_INVITAR, FORMULARIO } from '@/features/usuarios/textos';
import type { ClaseFalloInvitar } from '@/features/usuarios/errores';
import estilos from './FormularioInvitarUsuario.module.css';

export interface FormularioInvitarUsuarioProps {
  correo: string;
  /** Roles marcados, en el orden en que se marcaron. */
  roles: readonly Rol[];
  /** El correo no vale: sin forma de correo (navegador) o un 400 del servidor. */
  errorCorreo: boolean;
  /** No se marcó ningún rol. */
  errorRoles: boolean;
  /** Último fallo del servidor que se explica con una alerta; sin texto del servidor. */
  fallo: { clase: Exclude<ClaseFalloInvitar, 'correo' | 'permiso'> } | null;
  /** Hay un envío en curso: se bloquea y se anuncia. */
  pendiente: boolean;
  onCambiarCorreo(texto: string): void;
  onAlternarRol(rol: Rol): void;
  onEnviar(): void;
}

/**
 * Formulario «Invitar a una persona» (mockup `Usuarios.dc.html`): correo,
 * roles como casillas con su descripción y el envío. Solo presentación: el
 * borrador y los avisos llegan por props. Quien decide si la invitación vale
 * es el servidor.
 */
export function FormularioInvitarUsuario({
  correo,
  roles,
  errorCorreo,
  errorRoles,
  fallo,
  pendiente,
  onCambiarCorreo,
  onAlternarRol,
  onEnviar,
}: FormularioInvitarUsuarioProps) {
  const idTitulo = useId();
  const idAyudaRoles = useId();
  const refCorreo = useRef<HTMLInputElement>(null);
  const refPrimerRol = useRef<HTMLInputElement>(null);
  const refAlerta = useRef<HTMLDivElement>(null);
  // Cuenta de envíos intentados: cada intento fallido vuelve a llevar el foco.
  const intento = useRef(0);
  const intentoAtendido = useRef(0);

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    intento.current += 1;
    onEnviar();
  }

  // Foco al resolver el intento: primero el correo, luego los roles y al final
  // la alerta del servidor. Un campo apagado no puede recibirlo, así que se
  // espera a que `pendiente` baje.
  useEffect(() => {
    if (pendiente || intento.current === intentoAtendido.current) return;
    if (errorCorreo) {
      refCorreo.current?.focus();
    } else if (errorRoles) {
      refPrimerRol.current?.focus();
    } else if (fallo !== null) {
      refAlerta.current?.focus();
    } else {
      return;
    }
    intentoAtendido.current = intento.current;
  }, [pendiente, errorCorreo, errorRoles, fallo]);

  return (
    <section aria-labelledby={idTitulo} className={estilos.tarjeta}>
      <form
        noValidate
        aria-label={FORMULARIO.titulo}
        aria-busy={pendiente}
        className={estilos.formulario}
        onSubmit={alEnviar}
      >
        <h2 id={idTitulo} className={estilos.titulo}>
          {FORMULARIO.titulo}
        </h2>

        <Campo
          ref={refCorreo}
          etiqueta={FORMULARIO.etiquetaCorreo}
          type="email"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={FORMULARIO.marcadorCorreo}
          className={estilos.correo}
          value={correo}
          disabled={pendiente}
          onChange={(e) => onCambiarCorreo(e.target.value)}
          error={errorCorreo ? FORMULARIO.correoInvalido : undefined}
        />

        <fieldset aria-describedby={idAyudaRoles} className={estilos.roles}>
          <legend className={estilos.leyenda}>{FORMULARIO.rolesTitulo}</legend>
          <span id={idAyudaRoles} className={estilos.ayuda}>
            {FORMULARIO.rolesAyuda}
          </span>
          {ROLES.map((rol, indice) => {
            const marcado = roles.includes(rol);
            return (
              <label
                key={rol}
                className={`${estilos.rol} ${marcado ? estilos.marcado : ''}`}
              >
                <input
                  ref={indice === 0 ? refPrimerRol : undefined}
                  type="checkbox"
                  className={estilos.casilla}
                  checked={marcado}
                  disabled={pendiente}
                  onChange={() => onAlternarRol(rol)}
                />
                <span className={estilos.textoRol}>
                  <span className={estilos.nombreRol}>
                    {ETIQUETAS_ROL[rol]}
                  </span>
                  <span className={estilos.descripcionRol}>
                    {DESCRIPCIONES_ROL[rol]}
                  </span>
                </span>
              </label>
            );
          })}
          {errorRoles ? (
            <span role="alert" className={estilos.errorRoles}>
              {FORMULARIO.rolesVacio}
            </span>
          ) : null}
        </fieldset>

        {fallo !== null ? (
          <AlertaError ref={refAlerta} {...ALERTAS_INVITAR[fallo.clase]} />
        ) : null}

        <div className={estilos.acciones}>
          <Button
            type="submit"
            tono="conciliado"
            className={estilos.enviar}
            disabled={pendiente}
          >
            {pendiente ? FORMULARIO.enviando : FORMULARIO.enviar}
          </Button>
          {pendiente ? (
            <span role="status" className="solo-lectores">
              {FORMULARIO.enviandoEstado}
            </span>
          ) : null}
          <span className={estilos.vigencia}>{FORMULARIO.vigencia}</span>
        </div>
      </form>
    </section>
  );
}
