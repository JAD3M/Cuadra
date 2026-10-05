import { Button } from '@/shared/ui/Button';
import { paginaMaxima } from '@/features/bandeja/filtrosUrl';
import { ventanaDePaginas } from '@/features/bandeja/paginas';
import { PAGINACION } from '@/features/bandeja/textos';
import estilos from './Paginacion.module.css';

export interface PaginacionProps {
  /** Página actual, desde 1. */
  pagina: number;
  /** Total de movimientos que cumplen el filtro (el del servidor). */
  total: number;
  /** Filas por página. */
  limite: number;
  /** Pide ir a una página; nunca se llama con la actual ni fuera de rango. */
  onIr: (pagina: number) => void;
}

/**
 * Paginación de la bandeja. El rango visible («21–39 de 39») es decorativo
 * (`aria-hidden`) y un `role="status"` cortés lo anuncia completo
 * («Mostrando 21–39 de 39»). Con una sola página o sin resultados no hay
 * botones de página.
 */
export function Paginacion({ pagina, total, limite, onIr }: PaginacionProps) {
  const sinResultados = total === 0;
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);
  const rango = sinResultados
    ? PAGINACION.sinResultados
    : `${desde}–${hasta} de ${total}`;
  const anuncio = sinResultados
    ? PAGINACION.sinResultados
    : `${PAGINACION.mostrando} ${desde}–${hasta} de ${total}`;
  const totalPaginas = paginaMaxima(total, limite);
  const conControles = !sinResultados && totalPaginas > 1;

  return (
    <nav className={estilos.paginacion} aria-label={PAGINACION.nombre}>
      <span className={estilos.rango} aria-hidden="true">
        {rango}
      </span>
      <span role="status" className="solo-lectores">
        {anuncio}
      </span>
      {conControles ? (
        <div className={estilos.controles}>
          <Button
            variante="secundario"
            className={estilos.pagina}
            aria-label={PAGINACION.anterior}
            disabled={pagina <= 1}
            onClick={() => onIr(pagina - 1)}
          >
            ‹
          </Button>
          {ventanaDePaginas(pagina, totalPaginas).map((elemento, i) =>
            elemento === null ? (
              <span
                key={`elipsis-${i}`}
                className={estilos.elipsis}
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={elemento}
                variante="secundario"
                className={
                  elemento === pagina
                    ? `${estilos.pagina} ${estilos.actual}`
                    : estilos.pagina
                }
                aria-current={elemento === pagina ? 'page' : undefined}
                onClick={() => {
                  if (elemento !== pagina) onIr(elemento);
                }}
              >
                {elemento}
              </Button>
            ),
          )}
          <Button
            variante="secundario"
            className={estilos.pagina}
            aria-label={PAGINACION.siguiente}
            disabled={pagina >= totalPaginas}
            onClick={() => onIr(pagina + 1)}
          >
            ›
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
