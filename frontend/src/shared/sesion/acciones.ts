import type { QueryClient } from '@tanstack/react-query';
import type { ClienteApi } from '@/shared/api';
import {
  respuestaLogin,
  respuestaToken,
  type SolicitudLogin,
} from '@/shared/api/contratos';
import type { AlmacenTokens } from './almacenTokens';
import type { EstadoInterno, EventoSesion, Tienda } from './maquina';
import type { AccionesSesion } from './tipos';

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
export function crearAcciones({
  api,
  almacen,
  tienda,
  consultas,
}: DependenciasAcciones): AccionesSesion {
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

  return { iniciarSesion, elegirEmpresa, volverAlInicio };
}
