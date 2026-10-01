import { iniciales } from './iniciales';
import estilos from './CompanyBadge.module.css';

export interface CompanyBadgeProps {
  razonSocial: string;
  rfc: string;
}

/**
 * Insignia de la empresa activa: mosaico con iniciales, nombre y RFC en
 * fuente mono. No es interactiva y nunca recorta el RFC.
 */
export function CompanyBadge({ razonSocial, rfc }: CompanyBadgeProps) {
  return (
    <div className={estilos.insignia} role="group" aria-label="Empresa activa">
      <span className={estilos.mosaico} aria-hidden="true">
        {iniciales(razonSocial)}
      </span>
      <span className={estilos.datos}>
        <span className={estilos.nombre}>{razonSocial}</span>
        <span className={estilos.rfc}>{rfc}</span>
      </span>
    </div>
  );
}
