/** Fakes de `localStorage` y `matchMedia` para probar el tema. */

export interface AlmacenFalso extends Pick<Storage, 'getItem' | 'setItem'> {
  valores: Map<string, string>;
}

export function crearAlmacenFalso(
  inicial: Record<string, string> = {},
  { lanza = false }: { lanza?: boolean } = {},
): AlmacenFalso {
  const valores = new Map(Object.entries(inicial));
  return {
    valores,
    getItem(clave) {
      if (lanza) throw new Error('almacenamiento bloqueado');
      return valores.get(clave) ?? null;
    },
    setItem(clave, valor) {
      if (lanza) throw new Error('almacenamiento bloqueado');
      valores.set(clave, valor);
    },
  };
}

export interface MatchMediaFalso {
  matchMedia: (consulta: string) => MediaQueryList;
  /** Simula que el sistema operativo cambia de esquema. */
  cambiarSistema: (oscuro: boolean) => void;
  escuchas: () => number;
}

export function crearMatchMediaFalso(oscuroInicial: boolean): MatchMediaFalso {
  let oscuro = oscuroInicial;
  const oyentes = new Set<(e: MediaQueryListEvent) => void>();
  const consulta = {
    get matches() {
      return oscuro;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) =>
      oyentes.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) =>
      oyentes.delete(fn),
  } as unknown as MediaQueryList;
  return {
    matchMedia: () => consulta,
    cambiarSistema(valor) {
      oscuro = valor;
      oyentes.forEach((fn) => fn({ matches: valor } as MediaQueryListEvent));
    },
    escuchas: () => oyentes.size,
  };
}
