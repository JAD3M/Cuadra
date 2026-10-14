import type { ReactNode } from 'react';
import {
  TEXTOS_ALTA_EMPRESA,
  TEXTOS_INVITAR,
  TEXTOS_PLATAFORMA,
} from '@/features/plataforma/textos';
import { Button } from '@/shared/ui/Button';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import estilos from './EmpresasPlataforma.module.css';

/** Fila de la lista. Tipo propio: los componentes no importan la API. */
export interface FilaEmpresaPlataforma {
  id: string;
  razonSocial: string;
  rfc: string;
}

export interface EmpresasPlataformaProps {
  /** Las empresas; `null` mientras carga o si falló (ver `alerta`). */
  empresas: readonly FilaEmpresaPlataforma[] | null;
  /** Alerta de fallo ya armada por el contenedor. */
  alerta?: ReactNode;
  /** Acción del botón del estado vacío (abre el formulario de alta). */
  onCrear?: () => void;
  /** Acción «Invitar administrador» de una fila; sin ella no hay columna. */
  onInvitar?: (empresa: FilaEmpresaPlataforma) => void;
}

/**
 * Sección «Lista de empresas», con los cuatro estados del mockup: cargando
 * (barras), vacía (con botón de crear), con datos (tabla de razón social y
 * RFC) y fallo (alerta).
 */
export function EmpresasPlataforma({
  empresas,
  alerta,
  onCrear,
  onInvitar,
}: EmpresasPlataformaProps) {
  const cargando = empresas === null && !alerta;

  if (empresas !== null && empresas.length > 0) {
    return (
      <div className={estilos.tabla}>
        <Tabla titulo={TEXTOS_PLATAFORMA.listaEmpresas}>
          <thead>
            <tr>
              <Th>{TEXTOS_PLATAFORMA.columnaRazonSocial}</Th>
              <Th className={estilos.sinPartir}>
                {TEXTOS_PLATAFORMA.columnaRfc}
              </Th>
              {onInvitar && <Th>{TEXTOS_INVITAR.columnaAcciones}</Th>}
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id}>
                <Td>{empresa.razonSocial}</Td>
                <Td className={estilos.rfc}>{empresa.rfc}</Td>
                {onInvitar && (
                  <Td className={estilos.acciones}>
                    <Button
                      type="button"
                      variante="secundario"
                      aria-label={TEXTOS_INVITAR.etiquetaBoton(
                        empresa.razonSocial,
                      )}
                      onClick={() => onInvitar(empresa)}
                    >
                      {TEXTOS_INVITAR.boton}
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>
    );
  }

  const vacia = empresas !== null;
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
          {onCrear && (
            <Button type="button" className={estilos.crear} onClick={onCrear}>
              {TEXTOS_ALTA_EMPRESA.crear}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
