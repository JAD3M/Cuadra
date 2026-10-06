import { Button } from '@/shared/ui/Button';
import {
  ACTUALIZAR,
  LISTA_SIN_ACTUALIZAR,
  SE_ACTUALIZA_SOLA,
} from '@/features/cargas/textos';
import estilos from './AvisoActualizacion.module.css';

export interface AvisoActualizacionProps {
  /** `actualizando`: el polling corre. `detenida`: venció el tope y hace falta «Actualizar». */
  estado: 'actualizando' | 'detenida';
  /** `cabecera`: texto suelto en el encabezado del historial. `tarjeta`: caja dentro del resultado de una tarjeta. */
  variante: 'cabecera' | 'tarjeta';
  onActualizar?: () => void;
}

/**
 * Aviso del polling (K5, G13). Mientras corre solo dice que se actualiza sola;
 * «Actualizar» aparece únicamente tras el tope. No abre una región viva propia
 * (el mockup no la dibuja): en la tarjeta la anuncia la región de estado que
 * ya la contiene.
 */
export function AvisoActualizacion({
  estado,
  variante,
  onActualizar,
}: AvisoActualizacionProps) {
  if (estado === 'actualizando') {
    return <span className={estilos.texto}>{SE_ACTUALIZA_SOLA}</span>;
  }
  return (
    <span
      className={`${estilos.texto} ${variante === 'tarjeta' ? estilos.caja : ''}`}
    >
      {LISTA_SIN_ACTUALIZAR}
      <Button variante="secundario" onClick={onActualizar}>
        {ACTUALIZAR}
      </Button>
    </span>
  );
}
