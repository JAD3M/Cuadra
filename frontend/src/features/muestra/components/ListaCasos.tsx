import type { CasoMuestra } from '@/features/muestra/tipos';
import { Monto } from '@/shared/ui/Monto';
import { cumpleFiltro, type FiltroCasos } from '@/features/muestra/lista';
import { LISTA } from '@/features/muestra/textos';
import estilos from './ListaCasos.module.css';
import { IconoCruz, IconoPalomita } from './iconos';

export interface ListaCasosProps {
  casos: readonly CasoMuestra[];
  filtro: FiltroCasos;
  /** Cuántos casos hay por filtro (los del servidor, no los de la página). */
  conteos: Record<FiltroCasos, number>;
  seleccionada: string | null;
  onFiltro: (filtro: FiltroCasos) => void;
  onElegir: (decisionId: string) => void;
}

const FILTROS: readonly FiltroCasos[] = ['todos', 'pendientes', 'desacuerdo'];

function Chip({ caso }: { caso: CasoMuestra }) {
  if (caso.marca === 'conforme') {
    return (
      <span className={`${estilos.chip} ${estilos.chipOk}`}>
        <IconoPalomita tam={12} />
        {LISTA.chips.conforme}
      </span>
    );
  }
  if (caso.marca === 'desacuerdo') {
    return (
      <span className={`${estilos.chip} ${estilos.chipMal}`}>
        <IconoCruz tam={12} />
        {LISTA.chips.desacuerdo}
      </span>
    );
  }
  // Un caso reabierto sin marca no está pendiente: no lleva chip.
  if (caso.reabierta) return null;
  return (
    <span className={`${estilos.chip} ${estilos.chipPend}`}>
      {LISTA.chips.pendiente}
    </span>
  );
}

/** Lista de casos con sus filtros; el número es la posición en toda la muestra. */
export function ListaCasos({
  casos,
  filtro,
  conteos,
  seleccionada,
  onFiltro,
  onElegir,
}: ListaCasosProps) {
  const visibles = casos
    .map((caso, i) => ({ caso, n: i + 1 }))
    .filter(({ caso }) => cumpleFiltro(caso, filtro));
  return (
    <section className={estilos.tarjeta} aria-labelledby="muestra-lista-t">
      <h2 id="muestra-lista-t" className={estilos.titulo}>
        {LISTA.titulo}
      </h2>
      <div
        role="group"
        aria-label={LISTA.grupoFiltros}
        className={estilos.filtros}
      >
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            className={`${estilos.filtro} ${filtro === f ? estilos.filtroOn : ''}`}
            onClick={() => onFiltro(f)}
          >
            {LISTA[f]} <span className={estilos.mono}>{conteos[f]}</span>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className={estilos.vacia}>{LISTA.vacia}</p>
      ) : (
        <ul className={estilos.lista} aria-label={LISTA.titulo}>
          {visibles.map(({ caso, n }) => {
            const actual = caso.decisionId === seleccionada;
            return (
              <li key={caso.decisionId}>
                <button
                  type="button"
                  className={`${estilos.fila} ${actual ? estilos.sel : ''}`}
                  aria-current={actual ? 'true' : undefined}
                  onClick={() => onElegir(caso.decisionId)}
                >
                  <span className={`${estilos.mono} ${estilos.numero}`}>
                    #{n}
                  </span>
                  <span className={estilos.descripcion}>
                    <span className={estilos.desc}>{caso.descripcion}</span>
                    <span className={`${estilos.mono} ${estilos.ref}`}>
                      {[caso.referencia, caso.banco]
                        .filter((p) => p !== null && p !== '')
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={estilos.derecha}>
                    <span className={estilos.monto}>
                      <Monto
                        valor={caso.monto}
                        codigoMoneda={
                          caso.moneda === 'MXN' ? undefined : caso.moneda
                        }
                      />
                    </span>
                    <Chip caso={caso} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
