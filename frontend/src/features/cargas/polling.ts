import { esActiva, type EstadoCarga } from '@/shared/dominio';

interface ConEstado {
  estado: EstadoCarga;
}
interface ConIdYEstado extends ConEstado {
  id: string;
}

/** Hay al menos una carga que el servidor sigue procesando. */
export function hayActivas(filas: readonly ConEstado[] | undefined): boolean {
  return filas?.some((f) => esActiva(f.estado)) ?? false;
}

/**
 * Intervalo de `refetchInterval`: el dado mientras haya algo activo y la
 * ventana no esté capada; `false` (sin polling) en cualquier otro caso. Se
 * evalúa con el dato recién llegado, así que se detiene sin pedir de más.
 */
export function calcularIntervalo(
  filas: readonly ConEstado[] | undefined,
  capada: boolean,
  intervalo: number,
): number | false {
  return capada || !hayActivas(filas) ? false : intervalo;
}

/** Las cargas que estaban activas en la lectura previa y en la nueva ya terminaron. */
export function cargasTerminadas(
  previas: readonly ConIdYEstado[] | undefined,
  nuevas: readonly ConIdYEstado[],
): string[] {
  if (previas === undefined) return [];
  const activas = new Set(
    previas.filter((f) => esActiva(f.estado)).map((f) => f.id),
  );
  return nuevas
    .filter((f) => activas.has(f.id) && !esActiva(f.estado))
    .map((f) => f.id);
}

/** Alguna carga estaba activa en la lectura previa y en la nueva ya terminó. */
export function terminoAlgunaCarga(
  previas: readonly ConIdYEstado[] | undefined,
  nuevas: readonly ConIdYEstado[],
): boolean {
  return cargasTerminadas(previas, nuevas).length > 0;
}
