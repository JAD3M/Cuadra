import { useId } from 'react';
import type { ReactNode, Ref, TextareaHTMLAttributes } from 'react';
import estilos from './CampoMotivo.module.css';

export interface CampoMotivoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Texto visible de la etiqueta; siempre queda asociada al control. */
  etiqueta: string;
  /** Mensaje de error. Marca el control como inválido y lo describe. */
  error?: string;
  /** Texto de apoyo bajo el control. */
  ayuda?: ReactNode;
  /** Referencia al `textarea` (por ejemplo, para enfocarlo). */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Hermano multilínea de `Campo`: etiqueta arriba, `textarea`, ayuda y error
 * enlazados con `aria-describedby`. Solo presentación: sin estado.
 */
export function CampoMotivo({
  etiqueta,
  error,
  ayuda,
  id,
  className,
  ref,
  'aria-describedby': describedByExterno,
  ...resto
}: CampoMotivoProps) {
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
      <textarea
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
