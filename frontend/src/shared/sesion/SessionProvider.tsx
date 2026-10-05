import { useQueryClient } from '@tanstack/react-query';
import {
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api, configurarCliente } from '@/shared/api';
import { crearAcciones } from './acciones';
import { crearAlmacenTokens, type AlmacenTokens } from './almacenTokens';
import {
  ESTADO_INICIAL,
  crearTienda,
  reducir,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from './maquina';
import { SessionStateProvider } from './SessionStateProvider';
import type { SessionState } from './tipos';

export interface SessionProviderProps {
  children: ReactNode;
  /** Solo para pruebas: inyecta el almacén para inspeccionarlo. */
  almacen?: AlmacenTokens;
  /** Solo para pruebas: inyecta la tienda para leer la fase interna. */
  tienda?: Tienda<EstadoInterno, EventoSesion>;
}

/** Estado público a partir del interno. Nunca incluye un token. */
function publicar(interno: EstadoInterno): SessionState {
  switch (interno.fase) {
    case 'anonymous':
      return { status: 'anonymous' };
    case 'selecting':
      return {
        status: 'selecting',
        origen: interno.origen,
        usuario: interno.usuario,
        empresas: interno.empresas,
      };
    case 'sesion':
      return { status: 'loading', restaurarOrigen: interno.restaurarOrigen };
    case 'ended':
      return interno.email === undefined
        ? { status: 'ended', motivo: interno.motivo }
        : { status: 'ended', motivo: interno.motivo, email: interno.email };
  }
}

/**
 * Proveedor real de la sesión (memoria solamente). Une la máquina de
 * estados, el almacén de tokens y el cliente de la API; los tokens no pasan
 * por React.
 */
export function SessionProvider({
  children,
  almacen: almacenInyectado,
  tienda: tiendaInyectada,
}: SessionProviderProps) {
  const consultas = useQueryClient();
  const [almacen] = useState(() => almacenInyectado ?? crearAlmacenTokens());
  const [tienda] = useState(
    () => tiendaInyectada ?? crearTienda(reducir, ESTADO_INICIAL),
  );
  const [acciones] = useState(() =>
    crearAcciones({ api, almacen, tienda, consultas }),
  );

  // Layout effect: el cliente debe conocer al proveedor antes de que corra
  // cualquier efecto pasivo o consulta. El cleanup cubre el doble montaje de
  // StrictMode y el desmontaje entre pruebas.
  useLayoutEffect(() => {
    configurarCliente({ proveedorToken: almacen.proveedor() });
    return () => {
      configurarCliente({ proveedorToken: undefined });
    };
  }, [almacen]);

  const interno = useSyncExternalStore(tienda.suscribir, tienda.obtener);
  const estado = useMemo(() => publicar(interno), [interno]);

  return (
    <SessionStateProvider estado={estado} acciones={acciones}>
      {children}
    </SessionStateProvider>
  );
}
