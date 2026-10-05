import type { Rol } from '@/shared/dominio';
import { TarjetaEmpresa, type TonoTarjeta } from './TarjetaEmpresa';
import estilos from './ListaEmpresas.module.css';

/** Empresa elegible, tal como la muestra la lista (sin tipos de la API). */
export interface EmpresaElegible {
  id: string;
  razonSocial: string;
  rfc: string;
  roles: readonly Rol[];
}

export interface ListaEmpresasProps {
  empresas: readonly EmpresaElegible[];
  /** Empresa elegida cuya petición está en curso; `null` si ninguna. */
  pendienteId: string | null;
  onElegir(id: string): void;
  /** Id del encabezado que nombra la lista. */
  etiquetadaPor?: string;
}

/** Tonos decorativos que se reparten por posición. */
const TONOS: readonly TonoTarjeta[] = ['sugerencia', 'sin_match', 'conciliado'];

/**
 * Lista de empresas del paso 2. Con una petición en curso la lista anuncia
 * `aria-busy`, la tarjeta elegida muestra "Entrando…" y las demás quedan
 * inactivas. Una lista vacía no dibuja nada: el contenedor decide qué hacer.
 */
export function ListaEmpresas({
  empresas,
  pendienteId,
  onElegir,
  etiquetadaPor,
}: ListaEmpresasProps) {
  return (
    <ul
      className={estilos.lista}
      aria-labelledby={etiquetadaPor}
      aria-busy={pendienteId !== null}
    >
      {empresas.map((empresa, indice) => (
        <li key={empresa.id}>
          <TarjetaEmpresa
            razonSocial={empresa.razonSocial}
            rfc={empresa.rfc}
            roles={empresa.roles}
            tono={TONOS[indice % TONOS.length] ?? 'sugerencia'}
            pendiente={pendienteId === empresa.id}
            inactiva={pendienteId !== null && pendienteId !== empresa.id}
            onElegir={() => onElegir(empresa.id)}
          />
        </li>
      ))}
    </ul>
  );
}
