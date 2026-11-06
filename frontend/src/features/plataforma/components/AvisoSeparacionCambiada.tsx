import { TEXTOS_SEPARACION } from '@/features/plataforma/textos';
import estilos from './AvisoEmpresaCreada.module.css';

export interface AvisoSeparacionCambiadaProps {
  /** Razón social de la empresa cambiada. */
  razonSocial: string;
  /** `true` si quedó activa de nuevo; `false` si quedó desactivada. */
  activa: boolean;
}

/** Aviso de éxito de cambiar la separación de funciones (mockup `Plataforma.dc.html`). */
export function AvisoSeparacionCambiada({
  razonSocial,
  activa,
}: AvisoSeparacionCambiadaProps) {
  return (
    <div role="status" className={estilos.aviso}>
      <svg
        className={estilos.icono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </svg>
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>
          {activa
            ? TEXTOS_SEPARACION.activadaTitulo
            : TEXTOS_SEPARACION.desactivadaTitulo}
        </strong>
        <span className={estilos.detalle}>
          {TEXTOS_SEPARACION.cambiadaDetalle(razonSocial)}
        </span>
      </div>
    </div>
  );
}
