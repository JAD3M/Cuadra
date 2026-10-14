import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  esquemaCuentaExistente,
  esquemaCuentaNueva,
  type ValoresCuentaNueva,
} from '@/features/invitaciones/esquemaAceptar';
import { TEXTOS_INVITACION } from '@/features/invitaciones/textos';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import { CampoContrasena } from '@/shared/ui/CampoContrasena';
import estilos from './FormularioAceptarInvitacion.module.css';

export interface FormularioAceptarInvitacionProps {
  /** Razón social de la empresa que invita. */
  empresa: string;
  /** `true`: no hay cuenta, se piden nombre y contraseña. */
  cuentaNueva: boolean;
  /** Hay una aceptación en curso: el envío se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Corrección del servidor bajo la contraseña (ya en texto de usuario). */
  errorContrasena?: string;
  /** Aviso de cuenta existente o alerta de fallo, ya armados. */
  aviso?: ReactNode;
  /** Cuenta nueva: nombre y contraseña. Cuenta existente: `null`. */
  onEnviar(valores: ValoresCuentaNueva | null): void;
}

/**
 * Formulario de la invitación (mockup `Invitacion.dc.html`, estados
 * `cuenta_nueva`, `contrasena_corta` y `cuenta_existente`). Los campos no
 * son controlados: la contraseña vive solo en el nodo del DOM y la biblioteca
 * de formularios la lee al enviar. Con una cuenta existente no hay campos y
 * no se manda contraseña.
 */
export function FormularioAceptarInvitacion({
  empresa,
  cuentaNueva,
  pendiente,
  errorContrasena,
  aviso,
  onEnviar,
}: FormularioAceptarInvitacionProps) {
  const idTitulo = useId();
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<ValoresCuentaNueva>({
    resolver: zodResolver(
      cuentaNueva ? esquemaCuentaNueva : esquemaCuentaExistente,
    ),
    defaultValues: { nombre: '', password: '' },
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
        if (pendiente) return;
        onEnviar(cuentaNueva ? valores : null);
      })}
    >
      <div className={estilos.encabezado}>
        <span className={estilos.etiqueta}>{TEXTOS_INVITACION.etiqueta}</span>
        <h1 id={idTitulo} className={estilos.titulo}>
          {TEXTOS_INVITACION.titulo(empresa)}
        </h1>
        {cuentaNueva && (
          <p className={estilos.apoyo}>{TEXTOS_INVITACION.cuentaNueva}</p>
        )}
      </div>
      {aviso}
      {cuentaNueva && (
        <>
          <Campo
            etiqueta={TEXTOS_INVITACION.etiquetaNombre}
            type="text"
            autoComplete="name"
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <CampoContrasena
            etiqueta={TEXTOS_INVITACION.etiquetaContrasena}
            autoComplete="new-password"
            ayuda={TEXTOS_INVITACION.ayudaContrasena}
            error={errors.password?.message ?? errorContrasena}
            {...register('password')}
          />
        </>
      )}
      <Button type="submit" disabled={pendiente} className={estilos.entrar}>
        {pendiente
          ? TEXTOS_INVITACION.entrando
          : cuentaNueva
            ? TEXTOS_INVITACION.crearYEntrar
            : TEXTOS_INVITACION.aceptarYEntrar}
      </Button>
    </form>
  );
}
