import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  esquemaRestablecer,
  type ValoresRestablecer,
} from '@/features/recuperacion/esquemas';
import { TEXTOS_RECUPERACION } from '@/features/recuperacion/textos';
import { Button } from '@/shared/ui/Button';
import { CampoContrasena } from '@/shared/ui/CampoContrasena';
import estilos from './FormularioRecuperacion.module.css';

export interface FormularioRestablecerProps {
  /** Hay un guardado en curso: el botón se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Corrección del servidor bajo la contraseña (ya en texto de usuario). */
  errorContrasena?: string;
  /** Alerta de fallo, ya armada. */
  aviso?: ReactNode;
  onEnviar(valores: ValoresRestablecer): void;
}

/**
 * Elegir la contraseña nueva (mockup `Recuperar.dc.html`, estados
 * `restablecer` y `contrasena_corta`). El campo no es controlado: la
 * contraseña vive solo en el nodo del DOM y se lee al enviar.
 */
export function FormularioRestablecer({
  pendiente,
  errorContrasena,
  aviso,
  onEnviar,
}: FormularioRestablecerProps) {
  const idTitulo = useId();
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<ValoresRestablecer>({
    resolver: zodResolver(esquemaRestablecer),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (errorContrasena) setFocus('password');
  }, [errorContrasena, setFocus]);

  return (
    <form
      method="post"
      noValidate
      aria-labelledby={idTitulo}
      aria-busy={pendiente}
      className={estilos.formulario}
      onSubmit={handleSubmit((valores) => {
        if (!pendiente) onEnviar(valores);
      })}
    >
      <div className={estilos.encabezado}>
        <span className={estilos.etiqueta}>
          {TEXTOS_RECUPERACION.etiquetaNueva}
        </span>
        <h1 id={idTitulo} className={estilos.titulo}>
          {TEXTOS_RECUPERACION.tituloNueva}
        </h1>
        <p className={estilos.apoyo}>{TEXTOS_RECUPERACION.apoyoNueva}</p>
      </div>
      {aviso}
      <CampoContrasena
        etiqueta={TEXTOS_RECUPERACION.etiquetaContrasena}
        autoComplete="new-password"
        ayuda={TEXTOS_RECUPERACION.ayudaContrasena}
        error={errors.password?.message ?? errorContrasena}
        {...register('password')}
      />
      <Button type="submit" disabled={pendiente} className={estilos.entrar}>
        {pendiente
          ? TEXTOS_RECUPERACION.guardando
          : TEXTOS_RECUPERACION.guardar}
      </Button>
    </form>
  );
}
