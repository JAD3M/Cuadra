import {
  CLAVE_TEMA,
  CONSULTA_OSCURO,
  PREFERENCIAS,
  type Preferencia,
  type TemaResuelto,
} from './tipos';

function almacenPorOmision(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    // Acceder a `localStorage` puede lanzar cuando el navegador lo bloquea.
    return undefined;
  }
}

function esPreferencia(valor: unknown): valor is Preferencia {
  return PREFERENCIAS.includes(valor as Preferencia);
}

/** Lo ausente, inválido o inaccesible se lee como `system`. */
export function leerPreferencia(
  almacen: Pick<Storage, 'getItem'> | undefined = almacenPorOmision(),
): Preferencia {
  try {
    const valor = almacen?.getItem(CLAVE_TEMA);
    return esPreferencia(valor) ? valor : 'system';
  } catch {
    return 'system';
  }
}

/** Si el almacenamiento falla, la elección vale solo para esta sesión. */
export function guardarPreferencia(
  preferencia: Preferencia,
  almacen: Pick<Storage, 'setItem'> | undefined = almacenPorOmision(),
): void {
  try {
    almacen?.setItem(CLAVE_TEMA, preferencia);
  } catch {
    // Almacenamiento bloqueado o lleno: se ignora a propósito.
  }
}

/** Sin `matchMedia` (o si falla) se asume oscuro, igual que el CSS base. */
export function sistemaPrefiereOscuro(
  ventana: Pick<Window, 'matchMedia'> | undefined = globalThis.window,
): boolean {
  try {
    if (typeof ventana?.matchMedia !== 'function') return true;
    return ventana.matchMedia(CONSULTA_OSCURO).matches;
  } catch {
    return true;
  }
}

/** Lo único que JavaScript escribe en el documento. */
export function aplicarTema(
  tema: TemaResuelto,
  raiz: Pick<HTMLElement, 'setAttribute'> = document.documentElement,
): void {
  raiz.setAttribute('data-theme', tema);
}
