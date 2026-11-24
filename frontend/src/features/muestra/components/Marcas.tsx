import type { MarcaDeCaso } from '@/features/muestra/tipos';
import { instanteCorto } from '@/features/muestra/formato';
import { MARCAS } from '@/features/muestra/textos';
import estilos from './DetalleCaso.module.css';

/** «Marcas de este caso»: todas, la más reciente primero (como las manda el servidor). */
export function Marcas({ marcas }: { marcas: readonly MarcaDeCaso[] }) {
  if (marcas.length === 0) return null;
  return (
    <div className={estilos.historial}>
      <h3 className={estilos.rotulo}>{MARCAS.titulo}</h3>
      <ul className={estilos.marcas} aria-label={MARCAS.titulo}>
        {marcas.map((m) => (
          <li
            key={`${m.cuando}-${m.quien}-${m.resultado}`}
            className={estilos.marca}
          >
            <span className={estilos.mono}>{instanteCorto(m.cuando)}</span>
            <span>
              <strong className={estilos.quien}>{m.quien}</strong>
              {' · '}
              {MARCAS[m.resultado]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
