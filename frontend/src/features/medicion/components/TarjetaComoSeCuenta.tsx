import { useId } from 'react';
import { COMO_SE_CUENTA } from '@/features/medicion/textos';
import estilos from './TarjetaComoSeCuenta.module.css';

/** Explica qué cuenta como desacuerdo (definición de la historia 6.2). */
export function TarjetaComoSeCuenta() {
  const idTitulo = useId();
  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.titulo}>
        {COMO_SE_CUENTA.titulo}
      </h2>
      <ul className={estilos.lista}>
        {COMO_SE_CUENTA.puntos.map(({ marca, tono, texto }) => (
          <li key={texto} className={estilos.punto}>
            <span
              className={`${estilos.marca} ${estilos[tono]}`}
              aria-hidden="true"
            >
              {marca}
            </span>
            <span>{texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
