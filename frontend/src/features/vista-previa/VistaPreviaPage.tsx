import { useParams } from 'react-router';
import { VistaPreviaContenedor } from './VistaPreviaContenedor';

/**
 * Pantalla de la vista previa de una carga: lee `cargaId` de la ruta y monta
 * el contenedor con `key` para que, al pasar de una carga a otra, no sobreviva
 * ningún estado local (confirmación, resultado) de la anterior.
 */
export function VistaPreviaPage() {
  const { cargaId } = useParams<{ cargaId: string }>();
  if (cargaId === undefined) return null;
  return <VistaPreviaContenedor key={cargaId} cargaId={cargaId} />;
}
