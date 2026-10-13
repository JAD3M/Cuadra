import type { ReactNode } from 'react';
import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import estilos from './EmpresasPlataforma.module.css';

/** Fila de la lista: solo lo que la API devuelve, sin derivar nada. */
export interface FilaEmpresaPlataforma {
  id: string;
  razonSocial: string;
  rfc: string;
}

export interface EmpresasPlataformaProps {
  /** `null` mientras carga o si falló (ver `alerta`). */
  empresas: readonly FilaEmpresaPlataforma[] | null;
  /** Alerta de fallo ya armada por el contenedor. */
  alerta?: ReactNode;
}

/**
 * Sección «Lista de empresas». Vacía muestra el estado vacío del mockup; con
 * filas, una lista simple con razón social y RFC (la 1.4 define el resto).
 */
export function EmpresasPlataforma({
  empresas,
  alerta,
}: EmpresasPlataformaProps) {
  const vacia = empresas !== null && empresas.length === 0;
  return (
    <section
      aria-label={TEXTOS_PLATAFORMA.listaEmpresas}
      aria-busy={empresas === null && !alerta}
      className={
        vacia ? `${estilos.seccion} ${estilos.vacia}` : estilos.seccion
      }
    >
      {alerta}
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
      {empresas !== null && empresas.length > 0 && (
        <ul className={estilos.lista}>
          {empresas.map((empresa) => (
            <li key={empresa.id} className={estilos.fila}>
              <span className={estilos.razon}>{empresa.razonSocial}</span>
              <span className={estilos.rfc}>{empresa.rfc}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
