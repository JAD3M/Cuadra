import { useEpoca } from './claves';
import { ToleranciaContenedor } from './ToleranciaContenedor';

/**
 * Pantalla de tolerancia. El contenedor se monta con la época como `key`: un
 * cambio de empresa o de sesión lo desmonta y no queda borrador, éxito ni
 * alerta de la empresa anterior (ADR-4).
 */
export function TolerPage() {
  const epoca = useEpoca();
  return <ToleranciaContenedor key={String(epoca)} />;
}
