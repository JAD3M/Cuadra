import { useEffect, useId, useRef } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { ListaEmpresas, type EmpresaElegible } from './ListaEmpresas';
import estilos from './PasoEmpresa.module.css';

/**
 * Fallo al elegir empresa, ya convertido en texto para el usuario. Es un tipo
 * propio (y no el de `@/shared/api`) porque los componentes de presentación no
 * importan la API.
 */
export interface FalloEmpresa {
  titulo: string;
  detalle?: string;
}

export interface PasoEmpresaProps {
  saludo: string;
  empresas: readonly EmpresaElegible[];
  /** Empresa elegida cuya petición sigue en curso; `null` si ninguna. */
  pendienteId: string | null;
  fallo: FalloEmpresa | null;
  /** "← Cambiar de cuenta" o "← Volver sin cambiar de empresa". */
  textoVolver: string;
  /** Mueve el foco al título al montarse (llegada al paso). */
  enfocarTitulo?: boolean;
  /**
   * Nivel del título. `h1` en la pantalla (es el único de la página); la
   * galería, que ya tiene su `h1`, usa `h3`.
   */
  titulo?: 'h1' | 'h3';
  onElegir(id: string): void;
  onVolver(): void;
}

/**
 * Paso 2 de 2. Solo presentación: saludo, lista de empresas, la alerta de un
 * fallo y el enlace para volver. Al entrar el foco va al título; ante un fallo
 * nuevo va a la alerta, que además se anuncia por ser `role="alert"`.
 */
export function PasoEmpresa({
  saludo,
  empresas,
  pendienteId,
  fallo,
  textoVolver,
  enfocarTitulo = false,
  titulo: Titulo = 'h1',
  onElegir,
  onVolver,
}: PasoEmpresaProps) {
  const idTitulo = useId();
  const refTitulo = useRef<HTMLHeadingElement>(null);
  const refAlerta = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enfocarTitulo) refTitulo.current?.focus();
  }, [enfocarTitulo]);

  // Solo reacciona a un fallo nuevo: uno que ya estaba al montarse (galería)
  // no mueve el foco.
  const falloPrevio = useRef(fallo);
  useEffect(() => {
    if (fallo && fallo !== falloPrevio.current) refAlerta.current?.focus();
    falloPrevio.current = fallo;
  }, [fallo]);

  return (
    <section className={estilos.paso} aria-labelledby={idTitulo}>
      <div className={estilos.encabezado}>
        <span className={estilos.numero}>Paso 2 de 2</span>
        <Titulo
          ref={refTitulo}
          id={idTitulo}
          tabIndex={-1}
          className={estilos.titulo}
        >
          Elige empresa
        </Titulo>
        <p className={estilos.saludo}>{saludo}</p>
      </div>
      {fallo && (
        <AlertaError
          ref={refAlerta}
          titulo={fallo.titulo}
          detalle={fallo.detalle}
        />
      )}
      <ListaEmpresas
        empresas={empresas}
        pendienteId={pendienteId}
        onElegir={onElegir}
      />
      <button type="button" className={estilos.volver} onClick={onVolver}>
        {textoVolver}
      </button>
    </section>
  );
}
