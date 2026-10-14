import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import {
  esquemaSolicitar,
  type ValoresSolicitar,
} from '@/features/recuperacion/esquemas';
import { TEXTOS_RECUPERACION } from '@/features/recuperacion/textos';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import estilos from './FormularioRecuperacion.module.css';

export interface FormularioSolicitarProps {
  /** Hay un envío en curso: el botón se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Alerta de fallo, ya armada. */
  aviso?: ReactNode;
  onEnviar(valores: ValoresSolicitar): void;
}

/**
 * Pedir el enlace (mockup `Recuperar.dc.html`, estado `solicitar`). El
 * formulario no sabe si la cuenta existe: el servidor responde igual.
 */
export function FormularioSolicitar({
  pendiente,
  aviso,
  onEnviar,
}: FormularioSolicitarProps) {
  const idTitulo = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoresSolicitar>({
    resolver: zodResolver(esquemaSolicitar),
    defaultValues: { email: '' },
  });

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
        <span className={estilos.etiqueta}>{TEXTOS_RECUPERACION.etiqueta}</span>
        <h1 id={idTitulo} className={estilos.titulo}>
          {TEXTOS_RECUPERACION.titulo}
        </h1>
        <p className={estilos.apoyo}>{TEXTOS_RECUPERACION.apoyo}</p>
      </div>
      {aviso}
      <Campo
        etiqueta={TEXTOS_RECUPERACION.etiquetaCorreo}
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" disabled={pendiente} className={estilos.entrar}>
        {pendiente
          ? TEXTOS_RECUPERACION.enviando
          : TEXTOS_RECUPERACION.enviarEnlace}
      </Button>
      <Link to="/login" className={estilos.volver}>
        {TEXTOS_RECUPERACION.volverAlLogin}
      </Link>
    </form>
  );
}
