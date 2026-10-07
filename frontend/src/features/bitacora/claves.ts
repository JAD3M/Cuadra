import type { EpocaBandeja } from '@/features/bandeja/claves';
import type { ConsultaBitacora } from './consulta';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de la bitácora. Como en las demás pantallas, la segunda
// posición es la época de la sesión (un contador, nunca un token): al cambiar
// de empresa o de cuenta ninguna consulta anterior se sirve ni se reutiliza.
// Sin sesión lista la época es `null` y las consultas están deshabilitadas.
// La lista lleva la consulta tal como se envía (`armarConsulta`): dos filtros
// que piden lo mismo comparten caché, y cualquier cambio de filtro, de página
// o de límite da otra clave. Los «Cambios recientes» de la tolerancia tienen
// su clave propia (`clavesTolerancia.cambios`): son otra proyección.

export const clavesBitacora = {
  /** Prefijo común: la lista y los usuarios de una época. */
  todas: (epoca: EpocaBandeja) => ['bitacora', epoca] as const,
  /** `null` es «sin consulta» (rango invertido): nunca se pide. */
  lista: (epoca: EpocaBandeja, consulta: ConsultaBitacora | null) =>
    ['bitacora', epoca, 'lista', consulta] as const,
  usuarios: (epoca: EpocaBandeja) => ['bitacora', epoca, 'usuarios'] as const,
};
