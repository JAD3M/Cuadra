import { useParams } from 'react-router';
import { CasoContenedor } from './CasoContenedor';

/**
 * Pantalla del detalle de un caso: lee `movimientoId` de la ruta y monta el
 * contenedor con `key` para que, al pasar de un caso a otro, no sobreviva
 * ningún estado local (selección, texto) del anterior.
 */
export function CasoPage() {
  const { movimientoId } = useParams<{ movimientoId: string }>();
  if (movimientoId === undefined) return null;
  return <CasoContenedor key={movimientoId} movimientoId={movimientoId} />;
}
