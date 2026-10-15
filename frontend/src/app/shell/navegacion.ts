import type { Permiso } from '@/shared/dominio';
import { puede } from '@/shared/dominio';

/** Identificador del icono decorativo de cada elemento de navegación. */
export type IconoNav =
  'bandeja' | 'cargas' | 'bitacora' | 'tolerancia' | 'usuarios';

export interface ElementoNav {
  /** Clave estable, también usada para localizar el contador de pendientes. */
  clave: 'bandeja' | 'cargas' | 'bitacora' | 'tolerancia' | 'usuarios';
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
  /** Permiso de sección que hace visible el elemento (`/auth/contexto`). */
  permiso: Permiso;
}

export const ELEMENTOS_NAV: readonly ElementoNav[] = [
  {
    clave: 'bandeja',
    etiqueta: 'Bandeja',
    ruta: '/bandeja',
    activoEn: ['/bandeja', '/casos'],
    icono: 'bandeja',
    permiso: 'bandeja.ver',
  },
  {
    clave: 'cargas',
    etiqueta: 'Cargas',
    ruta: '/cargas',
    activoEn: ['/cargas'],
    icono: 'cargas',
    permiso: 'cargas.ver',
  },
  {
    clave: 'bitacora',
    etiqueta: 'Bitácora',
    ruta: '/bitacora',
    activoEn: ['/bitacora'],
    icono: 'bitacora',
    permiso: 'bitacora.ver',
  },
  {
    clave: 'tolerancia',
    etiqueta: 'Tolerancia',
    ruta: '/tolerancia',
    activoEn: ['/tolerancia'],
    icono: 'tolerancia',
    permiso: 'tolerancia.ver',
  },
  {
    clave: 'usuarios',
    etiqueta: 'Usuarios',
    ruta: '/usuarios',
    activoEn: ['/usuarios'],
    icono: 'usuarios',
    permiso: 'usuarios.ver',
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

/**
 * Elementos que la persona ve, en el orden fijo del menú. Se filtra por las
 * capacidades que entregó el servidor; ocultar es comodidad, el servidor
 * responde 403 igual.
 */
export function elementosVisibles(
  capacidades: readonly Permiso[],
): readonly ElementoNav[] {
  return ELEMENTOS_NAV.filter((elemento) =>
    puede(capacidades, elemento.permiso),
  );
}
