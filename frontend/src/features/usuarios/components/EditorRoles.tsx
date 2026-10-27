import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import {
  DESCRIPCIONES_ROL,
  ETIQUETAS_ROL,
  ROLES,
  type Rol,
} from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { ROLES_PERSONA } from '@/features/usuarios/textos';
import estilos from './EditorRoles.module.css';

export interface EditorRolesProps {
  correo: string;
  /** Roles marcados en el borrador. */
  seleccion: readonly Rol[];
  /** Una acción en vuelo: todos los controles esperan. */
  ocupado: boolean;
  onAlternar(rol: Rol): void;
  onGuardar(): void;
  onCancelar(): void;
}

/**
 * Editor de los roles de una persona activa (mockup `Usuarios.dc.html`, vistas
 * `editar_roles` y `editar_roles_vacio`). Presentacional: el borrador llega
 * por props. Sin ningún rol el envío pasa a «Guardar y quitar acceso» y se
 * avisa; quien decide es el servidor. Al abrirse lleva el foco a la primera
 * casilla.
 */
export function EditorRoles({
  correo,
  seleccion,
  ocupado,
  onAlternar,
  onGuardar,
  onCancelar,
}: EditorRolesProps) {
  const refPrimera = useRef<HTMLInputElement>(null);
  const vacio = seleccion.length === 0;

  useEffect(() => {
    refPrimera.current?.focus();
  }, []);

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    onGuardar();
  }

  return (
    <form
      noValidate
      aria-label={ROLES_PERSONA.formulario}
      aria-busy={ocupado}
      className={estilos.editor}
      onSubmit={alEnviar}
    >
      <fieldset className={estilos.roles}>
        <legend className={estilos.leyenda}>
          {ROLES_PERSONA.rolesDe}
          <span className={estilos.correo}>{correo}</span>
        </legend>
        {ROLES.map((rol, indice) => {
          const marcado = seleccion.includes(rol);
          return (
            <label
              key={rol}
              className={`${estilos.rol} ${marcado ? estilos.marcado : ''}`}
            >
              <input
                ref={indice === 0 ? refPrimera : undefined}
                type="checkbox"
                className={estilos.casilla}
                checked={marcado}
                disabled={ocupado}
                onChange={() => onAlternar(rol)}
              />
              <span className={estilos.textoRol}>
                <span className={estilos.nombreRol}>{ETIQUETAS_ROL[rol]}</span>
                <span className={estilos.descripcionRol}>
                  {DESCRIPCIONES_ROL[rol]}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {vacio && (
        <div role="status" className={estilos.avisoVacio}>
          <svg
            className={estilos.iconoAviso}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" />
          </svg>
          <span className={estilos.textoAviso}>
            {ROLES_PERSONA.sinRolesAviso}
          </span>
        </div>
      )}

      <div className={estilos.acciones}>
        <Button
          type="submit"
          tono="conciliado"
          className={estilos.accion}
          disabled={ocupado}
        >
          {vacio ? ROLES_PERSONA.guardarYQuitar : ROLES_PERSONA.guardar}
        </Button>
        <Button
          type="button"
          variante="secundario"
          className={estilos.accion}
          disabled={ocupado}
          onClick={onCancelar}
        >
          {ROLES_PERSONA.cancelar}
        </Button>
        <span className={estilos.nota}>{ROLES_PERSONA.aplicaSiguiente}</span>
      </div>
    </form>
  );
}
