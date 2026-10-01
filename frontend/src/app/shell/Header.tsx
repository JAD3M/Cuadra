import type { ReactNode } from 'react';
import { CompanyBadge } from './CompanyBadge';
import estilos from './Header.module.css';

export interface HeaderProps {
  /** Título de la página; es el único `h1`. */
  titulo: string;
  subtitulo?: string;
  empresa: { razonSocial: string; rfc: string };
  /** Barra superior para pantallas angostas (menú); opcional. */
  barraMovil?: ReactNode;
}

/** Encabezado de página: título, subtítulo e insignia de la empresa. */
export function Header({
  titulo,
  subtitulo,
  empresa,
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
        <CompanyBadge razonSocial={empresa.razonSocial} rfc={empresa.rfc} />
      </div>
    </header>
  );
}
