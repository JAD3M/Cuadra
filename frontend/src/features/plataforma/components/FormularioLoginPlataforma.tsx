import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import {
  esquemaLoginPlataforma,
  type ValoresLoginPlataforma,
} from '@/features/plataforma/esquemaLogin';
import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import estilos from './FormularioLoginPlataforma.module.css';

/**
 * Fallo del intento de acceso, ya convertido en texto para el usuario. Tipo
 * propio: los componentes de presentación no importan la API.
 */
export interface FalloLoginPlataforma {
  titulo: string;
  detalle?: string;
  /** `conexion` conserva la contraseña escrita; los demás la vacían. */
  tipo: string;
}

export interface FormularioLoginPlataformaProps {
  /** Hay un intento en curso: el envío se deshabilita y se anuncia. */
  pendiente: boolean;
  fallo: FalloLoginPlataforma | null;
  /** Aviso informativo sobre el formulario (por qué se llegó aquí). */
  aviso?: ReactNode;
  onEnviar(valores: ValoresLoginPlataforma): void;
}

/**
 * Acceso del dueño (mockup `Plataforma.dc.html`). Mismos campos y mecánica que
 * el de empresa, con su propia etiqueta y título. La contraseña vive solo en el
 * nodo del DOM; tras un fallo (salvo de conexión) se vacía y el foco va a ella.
 */
export function FormularioLoginPlataforma({
  pendiente,
  fallo,
  aviso,
  onEnviar,
}: FormularioLoginPlataformaProps) {
  const idTitulo = useId();
  const idAlerta = useId();
  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<ValoresLoginPlataforma>({
    resolver: zodResolver(esquemaLoginPlataforma),
    defaultValues: { email: '', password: '' },
  });

  const falloPrevio = useRef(fallo);
  useEffect(() => {
    if (fallo && fallo !== falloPrevio.current) {
      if (fallo.tipo !== 'conexion') setValue('password', '');
      setFocus('password');
    }
    falloPrevio.current = fallo;
  }, [fallo, setValue, setFocus]);

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
          {TEXTOS_PLATAFORMA.etiquetaAcceso}
        </span>
        <h1 id={idTitulo} className={estilos.titulo}>
          {TEXTOS_PLATAFORMA.tituloAcceso}
        </h1>
      </div>
      {aviso}
      {fallo && (
        <AlertaError
          id={idAlerta}
          titulo={fallo.titulo}
          detalle={fallo.detalle}
        />
      )}
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        aria-describedby={fallo ? idAlerta : undefined}
        {...register('password')}
      />
      <Button type="submit" disabled={pendiente} className={estilos.entrar}>
        {pendiente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
