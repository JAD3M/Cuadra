import { TEXTOS_INVITAR } from '@/features/plataforma/textos';
import estilos from './AvisoEmpresaCreada.module.css';

export interface AvisoInvitacionEnviadaProps {
  /** Correo tal como lo escribió quien invita; nunca se toma de la respuesta. */
  correo: string;
}

/**
 * Aviso de éxito de invitar (mockup `Plataforma.dc.html`, estado `enviada`).
 * El texto es el mismo exista o no la cuenta del correo.
 */
export function AvisoInvitacionEnviada({
  correo,
}: AvisoInvitacionEnviadaProps) {
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
          {TEXTOS_INVITAR.enviadaTitulo(correo)}
        </strong>
        <span className={estilos.detalle}>{TEXTOS_INVITAR.enviadaDetalle}</span>
      </div>
    </div>
  );
}
