import type { ReactNode } from 'react';
import { CompanyBadge } from './CompanyBadge';
import estilos from './Header.module.css';

export interface HeaderProps {
  /** Título de la página; es el único `h1`. */
  titulo: string;
  subtitulo?: string;
  empresa: { razonSocial: string; rfc: string };
  /** Abre el cambio de empresa; ausente = insignia estática. */
  onCambiarEmpresa?: () => void;
  /** El cambio de empresa está en curso. */
  cambioPendiente?: boolean;
  /** Barra superior para pantallas angostas (menú); opcional. */
  barraMovil?: ReactNode;
}

/** Encabezado de página: título, subtítulo e insignia de la empresa
 * (botón de cambio cuando se pasa `onCambiarEmpresa`). */
export function Header({
  titulo,
  subtitulo,
  empresa,
  onCambiarEmpresa,
  cambioPendiente,
  barraMovil,
}: HeaderProps) {
  return (
    <header className={estilos.encabezado}>
      {barraMovil}
      <div className={estilos.fila}>
        <div className={estilos.titulos}>
          <h1 className={estilos.titulo}>{titulo}</h1>
          {subtitulo && <span className={estilos.subtitulo}>{subtitulo}</span>}
        </div>
        <CompanyBadge
          razonSocial={empresa.razonSocial}
          rfc={empresa.rfc}
          onCambiar={onCambiarEmpresa}
          pendiente={cambioPendiente}
        />
      </div>
    </header>
  );
}
