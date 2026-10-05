import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';
import estilos from './Campo.module.css';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Texto visible de la etiqueta; siempre queda asociada al control. */
  etiqueta: string;
  /** Mensaje de error. Marca el control como inválido y lo describe. */
  error?: string;
  /** Texto de apoyo bajo el control. */
  ayuda?: string;
  /** Referencia al `input` (por ejemplo, para enfocarlo). */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Etiqueta, `input` y mensajes. El error y la ayuda se enlazan con
 * `aria-describedby`, sumados a lo que ya declare quien lo usa (por ejemplo
 * el id de una alerta del formulario). Solo presentación: sin estado.
 */
export function Campo({
  etiqueta,
  error,
  ayuda,
  id,
  className,
  ref,
  'aria-describedby': describedByExterno,
  ...resto
}: CampoProps) {
  const idGenerado = useId();
  const idControl = id ?? idGenerado;
  const idError = `${idControl}-error`;
  const idAyuda = `${idControl}-ayuda`;
  const descritoPor =
    [describedByExterno, ayuda ? idAyuda : null, error ? idError : null]
      .filter(Boolean)
      .join(' ') || undefined;
  const clases = [estilos.control, className].filter(Boolean).join(' ');

  return (
    <div className={estilos.campo}>
      <label htmlFor={idControl} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <input
        {...resto}
        ref={ref}
        id={idControl}
        className={clases}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor}
      />
      {ayuda && (
        <p id={idAyuda} className={estilos.ayuda}>
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className={estilos.error}>
          {error}
        </p>
      )}
    </div>
  );
}
