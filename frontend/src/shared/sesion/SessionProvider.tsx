import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api, configurarCliente } from '@/shared/api';
import { contextoSesion } from '@/shared/api/contratos';
import { claveContexto, crearAcciones } from './acciones';
import {
  ESTADO_ARRANQUE,
  crearTienda,
  reducir,
  sesionViva,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from './maquina';
import { SessionStateProvider } from './SessionStateProvider';
import type { SessionState } from './tipos';

export interface SessionProviderProps {
  children: ReactNode;
  /** Solo para pruebas: inyecta la tienda para leer la fase interna. */
  tienda?: Tienda<EstadoInterno, EventoSesion>;
}

type ConsultaContexto = Pick<
  ReturnType<typeof useContextoQuery>,
  'data' | 'isError'
>;

/**
 * Estado público a partir del interno y de la consulta del contexto. Nunca
 * incluye un token. Sin efectos: `loading`, `ready` y `unavailable` salen de
 * lo que la consulta ya sabe.
 */
function publicar(
  interno: EstadoInterno,
  consulta: ConsultaContexto,
): SessionState {
  switch (interno.fase) {
    case 'restaurando':
      return { status: 'restoring' };
    case 'anonymous':
      return { status: 'anonymous' };
    case 'selecting': {
      const base = {
        status: 'selecting',
        origen: interno.origen,
        usuario: interno.usuario,
        empresas: interno.empresas,
        epoca: interno.epoca,
      } as const;
      // En un cambio la sesión viva conserva su contexto: de ahí sale la
      // empresa activa para el saludo.
      return interno.origen === 'cambio' && consulta.data !== undefined
        ? { ...base, empresaActual: consulta.data.empresa }
        : base;
    }
    case 'sesion':
      if (consulta.data !== undefined) {
        return {
          status: 'ready',
          contexto: consulta.data,
          puedeCambiarEmpresa: interno.varias,
          restaurarOrigen: interno.restaurarOrigen,
          epoca: interno.epoca,
        };
      }
      if (consulta.isError) return { status: 'unavailable' };
      return { status: 'loading', restaurarOrigen: interno.restaurarOrigen };
    case 'ended':
      return interno.email === undefined
        ? { status: 'ended', motivo: interno.motivo }
        : { status: 'ended', motivo: interno.motivo, email: interno.email };
  }
}

/**
 * Contexto de la sesión (`GET /auth/contexto`). La clave lleva la época, un
 * contador, nunca un token ni un identificador. Sin `staleTime` finito no
 * hay recargas: volver de un cambio de empresa no parpadea.
 */
function useContextoQuery(interno: EstadoInterno) {
  return useQuery({
    queryKey: claveContexto(interno.epoca),
    queryFn: () => api.fetch('/auth/contexto', { schema: contextoSesion }),
    enabled: sesionViva(interno),
    staleTime: Infinity,
  });
}

/**
 * Proveedor real de la sesión (memoria solamente). Une la máquina de
 * estados y el cliente de la API. La sesión en sí es una cookie `httpOnly`:
 * al montar (arranque o recarga) pregunta al servidor si todavía vale.
 */
export function SessionProvider({
  children,
  tienda: tiendaInyectada,
}: SessionProviderProps) {
  const consultas = useQueryClient();
  const [tienda] = useState(
    () => tiendaInyectada ?? crearTienda(reducir, ESTADO_ARRANQUE),
  );
  const [acciones] = useState(() => crearAcciones({ api, tienda, consultas }));

  // Layout effect: el cliente debe conocer al proveedor antes de que corra
  // cualquier efecto pasivo o consulta. El cleanup cubre el doble montaje de
  // StrictMode y el desmontaje entre pruebas.
  useLayoutEffect(() => {
    configurarCliente({
      // Época de la sesión viva, o `null`: un 401 de una época anterior (la
      // sesión ya rotó o terminó) no termina la actual.
      proveedorEpoca: () => {
        const actual = tienda.obtener();
        return sesionViva(actual) ? actual.epoca : null;
      },
      // Solo termina si la fase lo admite; un 401 tardío se ignora.
      alTerminarSesion: (motivo) => acciones.terminar(motivo),
    });
    return () => {
      configurarCliente({
        proveedorEpoca: undefined,
        alTerminarSesion: undefined,
      });
    };
  }, [tienda, acciones]);

  // Arranque en frío: sin efecto si la tienda ya trae otra fase (pruebas).
  useEffect(() => {
    void acciones.restaurar();
  }, [acciones]);

  const interno = useSyncExternalStore(tienda.suscribir, tienda.obtener);
  const consulta = useContextoQuery(interno);
  const { data, isError } = consulta;
  const estado = useMemo(
    () => publicar(interno, { data, isError }),
    [interno, data, isError],
  );

  return (
    <SessionStateProvider estado={estado} acciones={acciones}>
      {children}
    </SessionStateProvider>
  );
}
