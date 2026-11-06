import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TEXTOS_SEPARACION } from '@/features/plataforma/textos';
import { Button } from '@/shared/ui/Button';
import { CampoMotivo } from './CampoMotivo';
import estilos from './FormularioCambiarSeparacion.module.css';

export interface FormularioCambiarSeparacionProps {
  /** Razón social de la empresa (título del panel). */
  razonSocial: string;
  /** `true` si el panel desactiva la separación; `false` si la reactiva. */
  desactivar: boolean;
  /** Hay un envío en curso: se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Corrección que dio el servidor bajo el campo (ya en texto de usuario). */
  errorMotivo?: string;
  /** Recibe el motivo ya recortado. */
  onEnviar(motivo: string): void;
  onCancelar(): void;
}

/**
 * Panel inline «Desactivar / Activar separación de funciones» (mockup
 * `Plataforma.dc.html`). Solo comprueba que el motivo no esté en blanco;
 * quien decide es el servidor. Conserva lo escrito tras un fallo.
 */
export function FormularioCambiarSeparacion({
  razonSocial,
  desactivar,
  pendiente,
  errorMotivo,
  onEnviar,
  onCancelar,
}: FormularioCambiarSeparacionProps) {
  const [motivo, setMotivo] = useState('');
  const [invalido, setInvalido] = useState(false);
  const refMotivo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    refMotivo.current?.focus();
  }, []);

  useEffect(() => {
    if (errorMotivo) refMotivo.current?.focus();
  }, [errorMotivo]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    const limpio = motivo.trim();
    if (limpio === '') {
      setInvalido(true);
      refMotivo.current?.focus();
      return;
    }
    setInvalido(false);
    onEnviar(limpio);
  }

  const mensaje =
    errorMotivo ?? (invalido ? TEXTOS_SEPARACION.motivoVacio : undefined);
  const boton = desactivar
    ? TEXTOS_SEPARACION.botonDesactivar
    : TEXTOS_SEPARACION.botonActivar;

  return (
    <form
      method="post"
      noValidate
      aria-label={
        desactivar
          ? TEXTOS_SEPARACION.formularioDesactivar
          : TEXTOS_SEPARACION.formularioActivar
      }
      aria-busy={pendiente}
      className={estilos.formulario}
      onSubmit={enviar}
    >
      <h2 className={estilos.titulo}>
        {desactivar
          ? TEXTOS_SEPARACION.tituloDesactivar(razonSocial)
          : TEXTOS_SEPARACION.tituloActivar(razonSocial)}
      </h2>
      <p className={estilos.texto}>
        {desactivar
          ? TEXTOS_SEPARACION.textoDesactivar
          : TEXTOS_SEPARACION.textoActivar}
      </p>
      <CampoMotivo
        ref={refMotivo}
        etiqueta={TEXTOS_SEPARACION.etiquetaMotivo}
        required
        maxLength={500}
        rows={3}
        className={estilos.campo}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        ayuda={TEXTOS_SEPARACION.ayudaMotivo}
        error={mensaje}
      />
      <div className={estilos.acciones}>
        <Button type="submit" disabled={pendiente} className={estilos.accion}>
          {pendiente ? TEXTOS_SEPARACION.guardando : boton}
        </Button>
        <Button
          type="button"
          variante="secundario"
          className={estilos.accion}
          onClick={onCancelar}
        >
          {TEXTOS_SEPARACION.cancelar}
        </Button>
      </div>
    </form>
  );
}
