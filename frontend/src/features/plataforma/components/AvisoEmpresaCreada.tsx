import { TEXTOS_ALTA_EMPRESA } from '@/features/plataforma/textos';
import estilos from './AvisoEmpresaCreada.module.css';

export interface AvisoEmpresaCreadaProps {
  /** Razón social de la empresa recién creada, tal como la guardó el servidor. */
  razonSocial: string;
}

/** Aviso de éxito del alta (mockup `Plataforma.dc.html`, estado `exito`). */
export function AvisoEmpresaCreada({ razonSocial }: AvisoEmpresaCreadaProps) {
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
          {TEXTOS_ALTA_EMPRESA.creadaTitulo}
        </strong>
        <span className={estilos.detalle}>
          {TEXTOS_ALTA_EMPRESA.creadaDetalle(razonSocial)}
        </span>
      </div>
    </div>
  );
}
