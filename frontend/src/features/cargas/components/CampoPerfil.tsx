import { useId } from 'react';
import {
  ERROR_PERFILES,
  REINTENTAR,
  TARJETA_ESTADO_CUENTA,
} from '@/features/cargas/textos';
import estilos from './campos.module.css';

export interface CampoPerfilProps {
  /** `undefined` mientras cargan o si la lista falló. */
  perfiles: readonly { id: string }[] | undefined;
  /** La lista falló: el select sigue visible, apagado, con aviso y Reintentar. */
  fallo?: boolean;
  /** El perfil elegido; ya resuelto por quien llama (por omisión, `cuadra`). */
  valor: string;
  onCambiar: (id: string) => void;
  onReintentar?: () => void;
  deshabilitado?: boolean;
}

/**
 * Perfil de lectura del estado de cuenta. Las opciones muestran el id, como el
 * mockup, en el orden de la API. Mientras la lista carga no se pinta nada. Si
 * falla, el select queda visible pero apagado, con el aviso y «Reintentar»
 * (mockup `perfiles_error`); el POST no manda `perfil` y el servidor usa el
 * suyo.
 */
export function CampoPerfil({
  perfiles,
  fallo = false,
  valor,
  onCambiar,
  onReintentar,
  deshabilitado = false,
}: CampoPerfilProps) {
  const id = useId();
  const idError = `${id}-error`;
  const lista = perfiles ?? [];
  if (!fallo && lista.length === 0) return null;
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {TARJETA_ESTADO_CUENTA.perfil}
      </label>
      <select
        id={id}
        className={estilos.control}
        value={valor}
        disabled={deshabilitado || fallo}
        aria-describedby={fallo ? idError : undefined}
        onChange={(e) => onCambiar(e.target.value)}
      >
        {lista.map((perfil) => (
          <option key={perfil.id} value={perfil.id}>
            {perfil.id}
          </option>
        ))}
      </select>
      {fallo ? (
        <span id={idError} className={estilos.errorPerfiles}>
          {ERROR_PERFILES}
          <button
            type="button"
            className={estilos.enlace}
            disabled={deshabilitado}
            onClick={onReintentar}
          >
            {REINTENTAR}
          </button>
        </span>
      ) : null}
    </div>
  );
}
