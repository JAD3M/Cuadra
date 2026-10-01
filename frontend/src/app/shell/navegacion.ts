/** Identificador del icono decorativo de cada elemento de navegación. */
export type IconoNav = 'bandeja' | 'cargas' | 'bitacora' | 'tolerancia';

export interface ElementoNav {
  /** Clave estable, también usada para localizar el contador de pendientes. */
  clave: 'bandeja' | 'cargas' | 'bitacora' | 'tolerancia';
  etiqueta: string;
  /** Destino del enlace. */
  ruta: string;
  /**
   * Prefijos de ruta en los que este elemento figura como activo. Es una
   * lista explícita: `/casos/:id` pertenece a Bandeja aunque la ruta no
   * empiece con `/bandeja`.
   */
  activoEn: readonly string[];
  icono: IconoNav;
}

export const ELEMENTOS_NAV: readonly ElementoNav[] = [
  {
    clave: 'bandeja',
    etiqueta: 'Bandeja',
    ruta: '/bandeja',
    activoEn: ['/bandeja', '/casos'],
    icono: 'bandeja',
  },
  {
    clave: 'cargas',
    etiqueta: 'Cargas',
    ruta: '/cargas',
    activoEn: ['/cargas'],
    icono: 'cargas',
  },
  {
    clave: 'bitacora',
    etiqueta: 'Bitácora',
    ruta: '/bitacora',
    activoEn: ['/bitacora'],
    icono: 'bitacora',
  },
  {
    clave: 'tolerancia',
    etiqueta: 'Tolerancia',
    ruta: '/tolerancia',
    activoEn: ['/tolerancia'],
    icono: 'tolerancia',
  },
];

/** `true` si la ruta es el prefijo o cuelga de él (`/casos` y `/casos/abc`, no `/casosx`). */
function coincidePrefijo(ruta: string, prefijo: string): boolean {
  return ruta === prefijo || ruta.startsWith(`${prefijo}/`);
}

/** Elemento activo para una ruta, o `undefined` si ninguno la reclama. */
export function elementoActivo(ruta: string): ElementoNav | undefined {
  return ELEMENTOS_NAV.find((elemento) =>
    elemento.activoEn.some((prefijo) => coincidePrefijo(ruta, prefijo)),
  );
}
