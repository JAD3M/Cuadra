import { MedicionContenedor } from './MedicionContenedor';
import { useEpoca } from './claves';

/**
 * Pantalla de medición. El contenedor se monta con la época como `key`: un
 * cambio de empresa o de sesión lo desmonta y no queda nada de la anterior.
 */
export function MedicionPage() {
  const epoca = useEpoca();
  return <MedicionContenedor key={String(epoca)} />;
}
