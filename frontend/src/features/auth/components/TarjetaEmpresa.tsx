import {
  ETIQUETAS_ROL,
  iniciales,
  ordenarRoles,
  type Rol,
} from '@/shared/dominio';
import { EstadoChip, type TonoEstadoChip } from '@/shared/ui/EstadoChip';
import estilos from './TarjetaEmpresa.module.css';

/** Tonos decorativos del mosaico y los chips; no significan un estado. */
export type TonoTarjeta = Extract<
  TonoEstadoChip,
  'sugerencia' | 'sin_match' | 'conciliado'
>;

export interface TarjetaEmpresaProps {
  razonSocial: string;
  rfc: string;
  roles: readonly Rol[];
  tono: TonoTarjeta;
  /** Es la tarjeta elegida y su petición sigue en curso. */
  pendiente?: boolean;
  /** Otra tarjeta está en curso: no se puede elegir esta. */
  inactiva?: boolean;
  onElegir(): void;
}

/**
 * Una empresa elegible. Es un botón: el nombre accesible sale de su contenido
 * (razón social, RFC y roles). Mientras otra petición está en curso no se usa
 * `disabled` (saldría del orden de tabulación y perdería el foco), sino
 * `aria-disabled` y se ignora el clic.
 */
export function TarjetaEmpresa({
  razonSocial,
  rfc,
  roles,
  tono,
  pendiente = false,
  inactiva = false,
  onElegir,
}: TarjetaEmpresaProps) {
  return (
    <button
      type="button"
      className={`${estilos.tarjeta} ${estilos[tono]}`}
      aria-disabled={inactiva || pendiente ? true : undefined}
      onClick={() => {
        if (!inactiva && !pendiente) onElegir();
      }}
    >
      <span className={estilos.mosaico} aria-hidden="true">
        {iniciales(razonSocial)}
      </span>
      <span className={estilos.datos}>
        <span className={estilos.nombre}>{razonSocial}</span>
        <span className={estilos.rfc}>{rfc}</span>
      </span>
      {pendiente ? (
        <span className={estilos.entrando}>Entrando…</span>
      ) : (
        <span className={estilos.roles}>
          {ordenarRoles(roles).map((rol) => (
            <EstadoChip key={rol} tono={tono}>
              {ETIQUETAS_ROL[rol]}
            </EstadoChip>
          ))}
        </span>
      )}
    </button>
  );
}
