import type { QueryClient } from '@tanstack/react-query';
import type { ClienteApi } from '@/shared/api';
import {
  respuestaLogin,
  respuestaToken,
  type SolicitudLogin,
} from '@/shared/api/contratos';
import type { AlmacenTokens } from './almacenTokens';
import {
  reducir,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from './maquina';
import type { AccionesSesion, MotivoSalida } from './tipos';

export interface DependenciasAcciones {
  api: ClienteApi;
  almacen: AlmacenTokens;
  tienda: Tienda<EstadoInterno, EventoSesion>;
  consultas: QueryClient;
}

/**
 * Acciones de la sesión. Cada una sigue el orden: cambiar el almacén de
 * tokens, vaciar la caché de consultas y, por último, enviar el evento a la
 * máquina; así ningún render ve la sesión nueva con datos de la anterior.
 *
 * Un evento que la máquina ignora no debe dejar tokens nuevos guardados, por
 * eso cada acción revisa la fase antes de actuar y otra vez al volver de la
 * red (el usuario pudo salir mientras la petición estaba en vuelo).
 */
/**
 * Acciones públicas más `terminar`, que solo usan el proveedor (el hook del
 * cliente de la API) y las propias acciones: las pantallas no terminan la
 * sesión por su cuenta.
 */
export interface AccionesInternas extends AccionesSesion {
  /** Termina la sesión por `motivo`; se ignora si la fase no lo admite. */
  terminar(motivo: MotivoSalida): void;
}

/** Clave de la consulta del contexto de la sesión de una época. */
export function claveContexto(epoca: number) {
  return ['sesion', epoca, 'contexto'] as const;
}

const MOTIVOS_CON_CORREO: readonly MotivoSalida[] = [
  'reingreso',
  'seleccion_vencida',
  'sin_empresas',
];

export function crearAcciones({
  api,
  almacen,
  tienda,
  consultas,
}: DependenciasAcciones): AccionesInternas {
  async function iniciarSesion(credenciales: SolicitudLogin): Promise<void> {
    const { fase } = tienda.obtener();
    if (fase !== 'anonymous' && fase !== 'ended') return;

    // Sin `Authorization`: el login no es una llamada de la sesión.
    const respuesta = await api.fetch('/auth/login', {
      method: 'POST',
      body: credenciales,
      schema: respuestaLogin,
      token: null,
    });

    const actual = tienda.obtener().fase;
    if (actual !== 'anonymous' && actual !== 'ended') return;
    almacen.fijarSeleccion(respuesta.token, credenciales.email);
    tienda.enviar({
      tipo: 'LOGIN_OK',
      usuario: respuesta.usuario,
      empresas: respuesta.empresas,
    });
  }

  async function elegirEmpresa(empresaId: string): Promise<void> {
    const inicial = tienda.obtener();
    const seleccion = almacen.seleccion();
    if (inicial.fase !== 'selecting' || seleccion === null) return;

    const respuesta = await api.fetch(
      `/auth/empresa/${encodeURIComponent(empresaId)}`,
      { method: 'POST', schema: respuestaToken, token: seleccion },
    );

    // Si mientras tanto se salió o se cambió de paso, la respuesta ya no
    // corresponde a esta selección.
    const actual = tienda.obtener();
    if (actual.fase !== 'selecting' || almacen.seleccion() !== seleccion) {
      return;
    }
    almacen.fijarSesion(respuesta.token);
    consultas.clear();
    tienda.enviar({ tipo: 'SELECCION_OK', empresaId });
  }

  function volverAlInicio(): void {
    const actual = tienda.obtener();
    if (actual.fase !== 'selecting' || actual.origen !== 'login') return;
    almacen.limpiar();
    consultas.clear();
    tienda.enviar({ tipo: 'VOLVER' });
  }

  /**
   * Cierra el ciclo de una sesión que ya no sirve: primero se descartan los
   * tokens y la caché y luego se avisa a la máquina. Solo si la máquina va a
   * aceptar el evento; si no, no se toca nada (p. ej. un 401 tardío).
   */
  function cerrarCon(evento: EventoSesion): void {
    const actual = tienda.obtener();
    if (Object.is(reducir(actual, evento), actual)) return;
    almacen.limpiar();
    consultas.clear();
    tienda.enviar(evento);
  }

  function terminar(motivo: MotivoSalida): void {
    const email = almacen.email();
    cerrarCon(
      MOTIVOS_CON_CORREO.includes(motivo) && email !== null
        ? { tipo: 'TERMINAR', motivo, email }
        : { tipo: 'TERMINAR', motivo },
    );
  }

  function cerrarSesion(): void {
    cerrarCon({ tipo: 'CIERRE' });
  }

  function reintentarContexto(): void {
    void consultas.refetchQueries({
      queryKey: claveContexto(tienda.obtener().epoca),
    });
  }

  function consumirFin(): void {
    tienda.enviar({ tipo: 'CONSUMIR' });
  }

  return {
    iniciarSesion,
    elegirEmpresa,
    volverAlInicio,
    cerrarSesion,
    reintentarContexto,
    consumirFin,
    terminar,
  };
}
