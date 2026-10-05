import type { QueryClient } from '@tanstack/react-query';
import { ApiError, type ClienteApi } from '@/shared/api';
import {
  listaEmpresasDisponibles,
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

  /** El motivo cuando el token de selección ya no sirve, según el paso. */
  function motivoDeVencimiento(origen: 'login' | 'cambio'): MotivoSalida {
    return origen === 'cambio' ? 'reingreso' : 'seleccion_vencida';
  }

  async function elegirEmpresa(empresaId: string): Promise<void> {
    const inicial = tienda.obtener();
    const seleccion = almacen.seleccion();
    if (inicial.fase !== 'selecting' || seleccion === null) return;

    // Si mientras tanto se salió o se cambió de paso, la respuesta ya no
    // corresponde a esta selección.
    const vigente = () =>
      tienda.obtener().fase === 'selecting' &&
      almacen.seleccion() === seleccion;

    let respuesta;
    try {
      respuesta = await api.fetch(
        `/auth/empresa/${encodeURIComponent(empresaId)}`,
        { method: 'POST', schema: respuestaToken, token: seleccion },
      );
    } catch (causa) {
      if (causa instanceof ApiError && vigente()) {
        if (causa.statusCode === 401) {
          terminar(motivoDeVencimiento(inicial.origen));
        } else if (causa.statusCode === 403) {
          // Perdió el acceso a esa empresa: la lista pudo haber cambiado. Si
          // el refresco falla se informa el 403 original.
          await refrescarEmpresas().catch(() => undefined);
        }
      }
      throw causa;
    }

    if (!vigente()) return;
    // En un cambio el token de sesión se reemplaza solo ahora, con la
    // elección ya aceptada. La caché se conserva si se vuelve a elegir la
    // misma empresa; con otra, nada del tenant anterior debe quedar a la vista.
    const mismaEmpresa =
      inicial.origen === 'cambio' && inicial.empresaId === empresaId;
    almacen.fijarSesion(respuesta.token);
    if (!mismaEmpresa) consultas.clear();
    tienda.enviar({ tipo: 'SELECCION_OK', empresaId });
  }

  async function cambiarEmpresa(): Promise<void> {
    if (tienda.obtener().fase !== 'sesion') return;
    const seleccion = almacen.seleccion();
    if (seleccion === null) {
      terminar('reingreso');
      return;
    }
    const vigente = () =>
      tienda.obtener().fase === 'sesion' && almacen.seleccion() === seleccion;

    let empresas;
    try {
      empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        token: seleccion,
      });
    } catch (causa) {
      // 401: la selección venció; hay que ingresar la contraseña otra vez.
      // Cualquier otro fallo deja la sesión como está y lo ve quien llamó.
      if (causa instanceof ApiError && causa.statusCode === 401 && vigente()) {
        terminar('reingreso');
      }
      throw causa;
    }

    if (!vigente()) return;
    if (empresas.length === 0) {
      terminar('sin_empresas');
      return;
    }
    // Sin vaciar la caché: el usuario puede abandonar el cambio.
    tienda.enviar({ tipo: 'CAMBIO_OK', empresas });
  }

  function regresarSinCambiar(): void {
    tienda.enviar({ tipo: 'REGRESAR' });
  }

  async function refrescarEmpresas(): Promise<void> {
    const inicial = tienda.obtener();
    const seleccion = almacen.seleccion();
    if (inicial.fase !== 'selecting' || seleccion === null) return;
    const vigente = () =>
      tienda.obtener().fase === 'selecting' &&
      almacen.seleccion() === seleccion;

    let empresas;
    try {
      empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        token: seleccion,
      });
    } catch (causa) {
      if (causa instanceof ApiError && causa.statusCode === 401 && vigente()) {
        terminar(motivoDeVencimiento(inicial.origen));
      }
      throw causa;
    }

    if (!vigente()) return;
    if (empresas.length === 0) {
      terminar('sin_empresas');
      return;
    }
    tienda.enviar({ tipo: 'EMPRESAS_REFRESCADAS', empresas });
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
    cambiarEmpresa,
    regresarSinCambiar,
    refrescarEmpresas,
    volverAlInicio,
    cerrarSesion,
    reintentarContexto,
    consumirFin,
    terminar,
  };
}
