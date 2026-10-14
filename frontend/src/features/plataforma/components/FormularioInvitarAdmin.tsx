import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TEXTOS_INVITAR } from '@/features/plataforma/textos';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import estilos from './FormularioInvitarAdmin.module.css';

export interface FormularioInvitarAdminProps {
  /** Razón social de la empresa a la que se invita (título del panel). */
  razonSocial: string;
  /** Hay un envío en curso: se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Corrección que dio el servidor bajo el campo (ya en texto de usuario). */
  errorCorreo?: string;
  /** Recibe el correo ya recortado. */
  onEnviar(correo: string): void;
  onCancelar(): void;
}

// Comodidad del navegador; quien decide si el correo vale es el servidor.
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Panel inline «Invitar administrador» (mockup `Plataforma.dc.html`). Solo
 * comprueba la forma del correo; conserva lo escrito tras un fallo.
 */
export function FormularioInvitarAdmin({
  razonSocial,
  pendiente,
  errorCorreo,
  onEnviar,
  onCancelar,
}: FormularioInvitarAdminProps) {
  const [correo, setCorreo] = useState('');
  const [invalido, setInvalido] = useState(false);
  const refCorreo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refCorreo.current?.focus();
  }, []);

  useEffect(() => {
    if (errorCorreo) refCorreo.current?.focus();
  }, [errorCorreo]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    const limpio = correo.trim();
    if (!FORMA_DE_CORREO.test(limpio)) {
      setInvalido(true);
      refCorreo.current?.focus();
      return;
    }
    setInvalido(false);
    onEnviar(limpio);
  }

  const mensaje =
    errorCorreo ?? (invalido ? TEXTOS_INVITAR.correoInvalido : undefined);

  return (
    <form
      method="post"
      noValidate
      aria-label={TEXTOS_INVITAR.boton}
      aria-busy={pendiente}
      className={estilos.formulario}
      onSubmit={enviar}
    >
      <h2 className={estilos.titulo}>{TEXTOS_INVITAR.titulo(razonSocial)}</h2>
      <Campo
        ref={refCorreo}
        etiqueta={TEXTOS_INVITAR.etiquetaCorreo}
        type="email"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={estilos.campo}
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        ayuda={TEXTOS_INVITAR.ayudaCorreo}
        error={mensaje}
      />
      <div className={estilos.acciones}>
        <Button type="submit" disabled={pendiente} className={estilos.accion}>
          {pendiente ? TEXTOS_INVITAR.enviando : TEXTOS_INVITAR.enviar}
        </Button>
        <Button
          type="button"
          variante="secundario"
          className={estilos.accion}
          onClick={onCancelar}
        >
          {TEXTOS_INVITAR.cancelar}
        </Button>
      </div>
    </form>
  );
}
