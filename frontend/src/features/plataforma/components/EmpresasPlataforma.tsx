import type { ReactNode } from 'react';
import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import estilos from './EmpresasPlataforma.module.css';

export interface EmpresasPlataformaProps {
  /** Cuántas empresas hay; `null` mientras carga o si falló (ver `alerta`). */
  total: number | null;
  /** Alerta de fallo ya armada por el contenedor. */
  alerta?: ReactNode;
}

/**
 * Sección «Lista de empresas», con los tres estados del mockup: cargando
 * (barras), vacía y fallo (alerta). La lista con empresas la define la 1.4 con
 * su mockup; hasta entonces el backend devuelve siempre `[]`.
 */
export function EmpresasPlataforma({
  total,
  alerta,
}: EmpresasPlataformaProps) {
  const vacia = total === 0;
  const cargando = total === null && !alerta;
  return (
    <section
      aria-label={TEXTOS_PLATAFORMA.listaEmpresas}
      aria-busy={cargando}
      className={
        vacia ? `${estilos.seccion} ${estilos.vacia}` : estilos.seccion
      }
    >
      {alerta}
      {cargando && (
        <div className={estilos.cargando} aria-hidden="true">
          <span className={estilos.barra} />
          <span className={estilos.barra} />
          <span className={estilos.barra} />
        </div>
      )}
      {vacia && (
        <>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            focusable="false"
            className={estilos.icono}
          >
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          <strong className={estilos.titulo}>
            {TEXTOS_PLATAFORMA.vacioTitulo}
          </strong>
          <span className={estilos.detalle}>
            {TEXTOS_PLATAFORMA.vacioDetalle}
          </span>
        </>
      )}
    </section>
  );
}
