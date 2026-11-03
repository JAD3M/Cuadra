import { TEXTOS_BANCOS } from '@/features/plataforma/textos';
import estilos from './AvisoEmpresaCreada.module.css';

export interface AvisoVistaPreviaLevantadaProps {
  /** Nombre del banco tal como lo ve la persona (BBVA). */
  banco: string;
}

/** Aviso de éxito de levantar la vista previa (mockup `Plataforma.dc.html`). */
export function AvisoVistaPreviaLevantada({
  banco,
}: AvisoVistaPreviaLevantadaProps) {
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
          {TEXTOS_BANCOS.levantadaTitulo(banco)}
        </strong>
        <span className={estilos.detalle}>
          {TEXTOS_BANCOS.levantadaDetalle}
        </span>
      </div>
    </div>
  );
}
