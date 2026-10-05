import { iniciales } from '@/shared/dominio';
import estilos from './CompanyBadge.module.css';

export interface CompanyBadgeProps {
  razonSocial: string;
  rfc: string;
  /**
   * Si se pasa, la insignia es el botón que abre el cambio de empresa. Sin
   * él es un grupo estático (usuario con una sola empresa).
   */
  onCambiar?: () => void;
  /** El cambio está en curso: el botón no responde a más clics. */
  pendiente?: boolean;
}

/**
 * Insignia de la empresa activa: mosaico con iniciales, nombre y RFC en
 * fuente mono. Nunca recorta el RFC. Con `onCambiar` es un botón con flecha;
 * sin él, un grupo que no recibe foco.
 */
export function CompanyBadge({
  razonSocial,
  rfc,
  onCambiar,
  pendiente = false,
}: CompanyBadgeProps) {
  const contenido = (
    <>
      <span className={estilos.mosaico} aria-hidden="true">
        {iniciales(razonSocial)}
      </span>
      <span className={estilos.datos}>
        <span className={estilos.nombre}>
          {onCambiar && (
            <>
              <span className="solo-lectores">
                Cambiar de empresa. Empresa activa:
              </span>{' '}
            </>
          )}
          {razonSocial}
        </span>{' '}
        <span className={estilos.rfc}>{rfc}</span>
      </span>
    </>
  );

  if (!onCambiar) {
    return (
      <div
        className={estilos.insignia}
        role="group"
        aria-label="Empresa activa"
      >
        {contenido}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${estilos.insignia} ${estilos.boton}`}
      aria-disabled={pendiente || undefined}
      aria-busy={pendiente || undefined}
      onClick={pendiente ? undefined : onCambiar}
    >
      {contenido}
      <svg
        className={estilos.flecha}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
