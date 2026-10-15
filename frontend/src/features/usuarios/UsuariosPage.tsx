import { useEpoca } from '@/features/bandeja/useEpoca';
import { UsuariosContenedor } from './UsuariosContenedor';

/**
 * Pantalla de Usuarios. El contenedor se monta con la época como `key`: un
 * cambio de empresa o de sesión lo desmonta y no queda borrador, confirmación
 * ni alerta de la empresa anterior.
 */
export function UsuariosPage() {
  const epoca = useEpoca();
  return <UsuariosContenedor key={String(epoca)} />;
}
