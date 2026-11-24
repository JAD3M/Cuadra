import { MuestraContenedor } from './MuestraContenedor';
import { useEpoca } from './claves';

/**
 * Pantalla de la muestra de verificación. El contenedor se monta con la época
 * como `key`: un cambio de empresa o de sesión lo desmonta y no queda nada de
 * la anterior.
 */
export function MuestraPage() {
  const epoca = useEpoca();
  return <MuestraContenedor key={String(epoca)} />;
}
