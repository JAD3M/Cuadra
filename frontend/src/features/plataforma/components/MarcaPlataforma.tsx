import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import estilos from './MarcaPlataforma.module.css';

export interface MarcaPlataformaProps {
  /** Tamaño del logo y del nombre: el panel del acceso usa el grande. */
  tamano?: 'normal' | 'grande';
}

/** Logo, nombre y chip «Plataforma». Solo presentación. */
export function MarcaPlataforma({ tamano = 'normal' }: MarcaPlataformaProps) {
  const lado = tamano === 'grande' ? 36 : 28;
  return (
    <div className={estilos.marca}>
      <svg
        className={estilos.logo}
        width={lado}
        height={lado}
        viewBox="0 0 36 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="3" width="30" height="30" rx="8" />
        <path d="M11 18l5 5 9-11" />
      </svg>
      <span className={estilos.nombre}>{TEXTOS_PLATAFORMA.marca}</span>
      <span className={estilos.chip}>{TEXTOS_PLATAFORMA.chip}</span>
    </div>
  );
}
