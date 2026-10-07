import { useId, type ChangeEvent } from 'react';
import {
  ACCIONES_BITACORA,
  ENTIDADES_BITACORA,
  type AccionBitacora,
  type EntidadBitacora,
} from '@/shared/dominio';
import { esRangoInvertido } from '@/features/bitacora/fechas';
import type { FiltrosBitacora } from '@/features/bitacora/filtrosUrl';
import {
  FILTROS,
  RANGO_INVERTIDO,
  USUARIOS_ERROR,
} from '@/features/bitacora/textos';
import estilos from './FiltrosBitacora.module.css';

/** Una persona del filtro de usuario; la respuesta de la API la cumple. */
export interface PersonaFiltro {
  id: string;
  nombre: string;
}

/** Lo que se sabe de la lista de personas del filtro. */
export type EstadoUsuarios =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; usuarios: readonly PersonaFiltro[] }
  | { tipo: 'error' };

/** Un cambio de filtros; la página la decide quien lo aplica (vuelve a 1). */
export type CambioFiltros = Partial<Omit<FiltrosBitacora, 'pagina'>>;

export interface FiltrosBitacoraProps {
  filtros: FiltrosBitacora;
  usuarios: EstadoUsuarios;
  onCambiar: (cambio: CambioFiltros) => void;
}

/** El valor elegido, o `undefined` para «Todas» o algo que no está en la lista. */
function elegido<T extends string>(
  lista: readonly T[],
  valor: string,
): T | undefined {
  return lista.find((opcion) => opcion === valor);
}

/** El día de un `<input type="date">`; vacío (o a medio escribir) es «sin filtro». */
const dia = (evento: ChangeEvent<HTMLInputElement>): string | undefined =>
  evento.target.value === '' ? undefined : evento.target.value;

/**
 * Filtros de la bitácora (Bitacora.dc.html). Presentacional: cada cambio sale
 * por `onCambiar` y la URL es la fuente de verdad. Las opciones de entidad y
 * acción son los valores de la API, sin traducir. Con «Desde» posterior a
 * «Hasta» marca «Hasta» como inválido y lo avisa; no hay botón de enviar: un
 * filtro se aplica al cambiar.
 */
export function FiltrosBitacora({
  filtros,
  usuarios,
  onCambiar,
}: FiltrosBitacoraProps) {
  const id = useId();
  const ids = {
    entidad: `${id}-entidad`,
    accion: `${id}-accion`,
    usuario: `${id}-usuario`,
    usuarioError: `${id}-usuario-error`,
    desde: `${id}-desde`,
    hasta: `${id}-hasta`,
    rango: `${id}-rango`,
  };
  const rangoInvertido = esRangoInvertido(filtros.desde, filtros.hasta);
  const personas = usuarios.tipo === 'lista' ? usuarios.usuarios : [];
  // Un usuario de la URL que la lista no trae (aún cargando, falló o ya no es
  // de la empresa) se conserva como opción con su id: el select nunca miente
  // mostrando «Todos» mientras la consulta sí filtra.
  const huerfano =
    filtros.usuario !== undefined &&
    !personas.some((p) => p.id === filtros.usuario)
      ? filtros.usuario
      : undefined;

  return (
    <form
      className={estilos.filtros}
      aria-label={FILTROS.nombre}
      onSubmit={(evento) => evento.preventDefault()}
    >
      <div className={estilos.campo}>
        <label htmlFor={ids.entidad}>{FILTROS.entidad}</label>
        <select
          id={ids.entidad}
          className={estilos.control}
          value={filtros.entidad ?? ''}
          onChange={(evento) =>
            onCambiar({
              entidad: elegido<EntidadBitacora>(
                ENTIDADES_BITACORA,
                evento.target.value,
              ),
            })
          }
        >
          <option value="">{FILTROS.todas}</option>
          {ENTIDADES_BITACORA.map((entidad) => (
            <option key={entidad} value={entidad}>
              {entidad}
            </option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label htmlFor={ids.accion}>{FILTROS.accion}</label>
        <select
          id={ids.accion}
          className={estilos.control}
          value={filtros.accion ?? ''}
          onChange={(evento) =>
            onCambiar({
              accion: elegido<AccionBitacora>(
                ACCIONES_BITACORA,
                evento.target.value,
              ),
            })
          }
        >
          <option value="">{FILTROS.todas}</option>
          {ACCIONES_BITACORA.map((accion) => (
            <option key={accion} value={accion}>
              {accion}
            </option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label htmlFor={ids.usuario}>{FILTROS.usuario}</label>
        <select
          id={ids.usuario}
          className={estilos.control}
          value={filtros.usuario ?? ''}
          aria-describedby={
            usuarios.tipo === 'error' ? ids.usuarioError : undefined
          }
          onChange={(evento) =>
            onCambiar({
              usuario:
                evento.target.value === '' ? undefined : evento.target.value,
            })
          }
        >
          <option value="">{FILTROS.todos}</option>
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
          {huerfano !== undefined ? (
            <option value={huerfano}>{huerfano}</option>
          ) : null}
        </select>
        {usuarios.tipo === 'error' ? (
          <span id={ids.usuarioError} className={estilos.error}>
            {USUARIOS_ERROR}
          </span>
        ) : null}
      </div>

      <div className={estilos.campo}>
        <label htmlFor={ids.desde}>{FILTROS.desde}</label>
        <input
          id={ids.desde}
          type="date"
          className={`${estilos.control} ${estilos.fecha}`}
          value={filtros.desde ?? ''}
          onChange={(evento) => onCambiar({ desde: dia(evento) })}
        />
      </div>

      <div className={estilos.campo}>
        <label htmlFor={ids.hasta}>{FILTROS.hasta}</label>
        <input
          id={ids.hasta}
          type="date"
          className={`${estilos.control} ${estilos.fecha}`}
          value={filtros.hasta ?? ''}
          aria-invalid={rangoInvertido ? true : undefined}
          aria-describedby={rangoInvertido ? ids.rango : undefined}
          onChange={(evento) => onCambiar({ hasta: dia(evento) })}
        />
      </div>

      {rangoInvertido ? (
        <span id={ids.rango} className={estilos.rango}>
          {RANGO_INVERTIDO}
        </span>
      ) : null}
    </form>
  );
}
