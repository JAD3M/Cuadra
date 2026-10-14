import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { esquemaLogin, type ValoresLogin } from '@/features/auth/esquemaLogin';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import { CampoContrasena } from '@/shared/ui/CampoContrasena';
import estilos from './FormularioLogin.module.css';

/**
 * Fallo del intento de acceso, ya convertido en texto para el usuario. Es un
 * tipo propio (y no el de `@/shared/api`) porque los componentes de
 * presentación no importan la API.
 */
export interface FalloLogin {
  titulo: string;
  detalle?: string;
  /** `conexion` conserva la contraseña escrita; los demás la vacían. */
  tipo:
    | 'credenciales'
    | 'sin_empresas'
    | 'sin_acceso'
    | 'sin_permiso'
    | 'conexion'
    | 'otro';
}

export interface FormularioLoginProps {
  /** Correo con el que se rellena el campo (reingreso). */
  correoInicial?: string;
  /** Hay un intento en curso: el envío se deshabilita y se anuncia. */
  pendiente: boolean;
  fallo: FalloLogin | null;
  /** Aviso informativo sobre el formulario (por qué se llegó aquí). */
  aviso?: ReactNode;
  /** Mueve el foco al correo al montarse (llegada desde "Cambiar de cuenta"). */
  enfocarCorreo?: boolean;
  /**
   * Nivel del título. `h1` en la pantalla de acceso (es el único de la
   * página); la galería, que ya tiene su `h1`, usa `h3`.
   */
  titulo?: 'h1' | 'h3';
  /**
   * Enlace «¿Olvidaste tu contraseña?», ya armado: el formulario no importa
   * el enrutador. Va bajo el campo de la contraseña.
   */
  enlaceOlvido?: ReactNode;
  onEnviar(valores: ValoresLogin): void;
}

/**
 * Paso 1 de 2. Los campos no son controlados: la contraseña vive solo en el
 * nodo del DOM y la biblioteca de formularios la lee al enviar. Tras un fallo
 * de credenciales se vacía y el foco va a ella, con la alerta enlazada por
 * `aria-describedby` para que se lea aunque se pierda el anuncio en vivo.
 */
export function FormularioLogin({
  correoInicial = '',
  pendiente,
  fallo,
  aviso,
  enfocarCorreo = false,
  titulo: Titulo = 'h1',
  enlaceOlvido,
  onEnviar,
}: FormularioLoginProps) {
  const idTitulo = useId();
  const idAlerta = useId();
  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<ValoresLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: correoInicial, password: '' },
  });

  useEffect(() => {
    if (enfocarCorreo) setFocus('email');
  }, [enfocarCorreo, setFocus]);

  // Solo reacciona a un fallo nuevo: uno que ya estaba al montarse (galería)
  // no mueve el foco ni toca los campos.
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
        <span className={estilos.paso}>Paso 1 de 2</span>
        <Titulo id={idTitulo} className={estilos.titulo}>
          Inicia sesión
        </Titulo>
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
      <CampoContrasena
        etiqueta="Contraseña"
        autoComplete="current-password"
        error={errors.password?.message}
        aria-describedby={fallo ? idAlerta : undefined}
        {...register('password')}
      />
      {enlaceOlvido && <div className={estilos.olvido}>{enlaceOlvido}</div>}
      <Button type="submit" disabled={pendiente} className={estilos.entrar}>
        {pendiente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
