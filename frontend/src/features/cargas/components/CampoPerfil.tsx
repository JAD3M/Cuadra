import { useId } from 'react';
import { TARJETA_ESTADO_CUENTA } from '@/features/cargas/textos';
import estilos from './campos.module.css';

export interface CampoPerfilProps {
  /** `undefined` si la lista no cargó: el campo se oculta (4.5, G9). */
  perfiles: readonly { id: string }[] | undefined;
  /** El perfil elegido; ya resuelto por quien llama (por omisión, `cuadra`). */
  valor: string;
  onCambiar: (id: string) => void;
  deshabilitado?: boolean;
}

/**
 * Perfil de lectura del estado de cuenta. Las opciones muestran el id, como el
 * mockup, en el orden de la API. Sin perfiles no se pinta nada y el POST no
 * manda `perfil`: el servidor usa el suyo.
 */
export function CampoPerfil({
  perfiles,
  valor,
  onCambiar,
  deshabilitado = false,
}: CampoPerfilProps) {
  const id = useId();
  if (perfiles === undefined || perfiles.length === 0) return null;
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {TARJETA_ESTADO_CUENTA.perfil}
      </label>
      <select
        id={id}
        className={estilos.control}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => onCambiar(e.target.value)}
      >
        {perfiles.map((perfil) => (
          <option key={perfil.id} value={perfil.id}>
            {perfil.id}
          </option>
        ))}
      </select>
    </div>
  );
}
