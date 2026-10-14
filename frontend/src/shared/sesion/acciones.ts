import type { QueryClient } from '@tanstack/react-query';
import { ApiError, reintentarConsulta, type ClienteApi } from '@/shared/api';
import {
  contextoSesion,
  listaEmpresasDisponibles,
  respuestaLogin,
  type SolicitudLogin,
} from '@/shared/api/contratos';
import {
  reducir,
  sesionViva,
  type EstadoInterno,
  type EventoSesion,
  type Tienda,
} from './maquina';
import type { AccionesSesion, MotivoSalida } from './tipos';

export interface DependenciasAcciones {
  api: ClienteApi;
  tienda: Tienda<EstadoInterno, EventoSesion>;
  consultas: QueryClient;
}

/**
 * Acciones públicas más `terminar` y `restaurar`, que solo usan el proveedor
 * (el hook del cliente de la API y el arranque): las pantallas no terminan ni
 * restauran la sesión por su cuenta.
 */
export interface AccionesInternas extends AccionesSesion {
  /** Termina la sesión por `motivo`; se ignora si la fase no lo admite. */
  terminar(motivo: MotivoSalida): void;
  /**
   * Arranque en frío: pregunta al servidor si la cookie todavía vale. Sin
   * efecto fuera de la fase `restaurando`; llamarla dos veces comparte la
   * misma petición (StrictMode monta los efectos dos veces).
   */
  restaurar(): Promise<void>;
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

/**
 * Acciones de la sesión. La sesión es una cookie `httpOnly` que el navegador
 * manda solo (`credentials: 'include'`); aquí no hay ningún token. Cada acción
 * vacía la caché de consultas antes de enviar el evento a la máquina, así
 * ningún render ve la sesión nueva con datos de la anterior.
 *
 * Cada acción revisa la fase antes de actuar y otra vez al volver de la red
 * (el usuario pudo salir mientras la petición estaba en vuelo).
 */
export function crearAcciones({
  api,
  tienda,
  consultas,
}: DependenciasAcciones): AccionesInternas {
  // Correo con el que se inició sesión; solo para rellenar el reingreso.
  // Memoria del cierre: no es un secreto, pero tampoco se persiste.
  let email: string | null = null;
  // Cambia cada vez que la sesión se cierra o se reinicia: una respuesta que
  // salió antes de ese cambio ya no corresponde a la sesión actual.
  let generacion = 0;
  let restauracion: Promise<void> | null = null;

  const empezar = () => generacion;

  async function iniciarSesion(credenciales: SolicitudLogin): Promise<void> {
    const { fase } = tienda.obtener();
    if (fase !== 'anonymous' && fase !== 'ended') return;

    // El servidor pone la cookie en la respuesta; el cuerpo no trae token.
    const respuesta = await api.fetch('/auth/login', {
      method: 'POST',
      body: credenciales,
      schema: respuestaLogin,
      terminaSesion: false,
    });

    const actual = tienda.obtener().fase;
    if (actual !== 'anonymous' && actual !== 'ended') return;
    generacion += 1;
    email = credenciales.email;
    tienda.enviar({
      tipo: 'LOGIN_OK',
      usuario: respuesta.usuario,
      empresas: respuesta.empresas,
    });
  }

  /** El motivo cuando la sesión sin empresa o el reingreso ya no sirven, según el paso. */
  function motivoDeVencimiento(origen: 'login' | 'cambio'): MotivoSalida {
    return origen === 'cambio' ? 'reingreso' : 'seleccion_vencida';
  }

  async function elegirEmpresa(empresaId: string): Promise<void> {
    const inicial = tienda.obtener();
    if (inicial.fase !== 'selecting') return;

    // Elegir la empresa que ya está activa equivale a abandonar el cambio: sin
    // petición, sin cambio de época y con la caché intacta.
    if (inicial.origen === 'cambio' && inicial.empresaId === empresaId) {
      regresarSinCambiar();
      return;
    }

    // Si mientras tanto se salió o se cambió de paso, la respuesta ya no
    // corresponde a esta selección.
    const desde = empezar();
    const vigente = () =>
      tienda.obtener().fase === 'selecting' && generacion === desde;

    let contexto;
    try {
      // El servidor rota la cookie y responde el contexto de la empresa.
      contexto = await api.fetch(
        `/auth/empresa/${encodeURIComponent(empresaId)}`,
        { method: 'POST', schema: contextoSesion, terminaSesion: false },
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
    // En un cambio la sesión se reemplaza solo ahora, con la elección ya
    // aceptada. Nunca es la empresa activa (esa regresa antes), así que nada
    // del tenant anterior debe quedar a la vista. El contexto que devolvió el
    // servidor se guarda en la época nueva: no hace falta pedirlo otra vez.
    consultas.clear();
    consultas.setQueryData(claveContexto(tienda.obtener().epoca + 1), contexto);
    tienda.enviar({ tipo: 'SELECCION_OK', empresaId });
  }

  /**
   * Tras aceptar una invitación el servidor ya puso la cookie de una sesión
   * con empresa. Pide el contexto con ella, descarta todo lo de la sesión
   * anterior (si la había) y entra. Si el contexto falla, rechaza sin tocar el
   * estado.
   */
  async function abrirSesionDeInvitacion(): Promise<void> {
    const desde = empezar();
    const contexto = await api.fetch('/auth/contexto', {
      schema: contextoSesion,
      terminaSesion: false,
    });
    // Salió o se reinició la sesión mientras se pedía: esta respuesta ya no
    // corresponde.
    if (generacion !== desde) return;
    generacion += 1;
    email = null;
    consultas.clear();
    consultas.setQueryData(claveContexto(tienda.obtener().epoca + 1), contexto);
    tienda.enviar({
      tipo: 'SESION_ABIERTA',
      usuario: contexto.usuario,
      empresaId: contexto.empresa.id,
    });
    await conocerEmpresas();
  }

  async function cambiarEmpresa(): Promise<void> {
    if (tienda.obtener().fase !== 'sesion') return;
    const desde = empezar();
    const vigente = () =>
      tienda.obtener().fase === 'sesion' && generacion === desde;

    let empresas;
    try {
      empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        terminaSesion: false,
      });
    } catch (causa) {
      // 401: la cookie dejó de valer (venció o se cerró en otro lado); hay
      // que ingresar la contraseña otra vez. Cualquier otro fallo deja la
      // sesión como está y lo ve quien llamó.
      if (causa instanceof ApiError && causa.statusCode === 401 && vigente()) {
        cancelarEnElServidor();
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
    if (inicial.fase !== 'selecting') return;
    const desde = empezar();
    const vigente = () =>
      tienda.obtener().fase === 'selecting' && generacion === desde;

    let empresas;
    try {
      empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        terminaSesion: false,
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
    // La sesión sin empresa sigue en el servidor hasta que venza: se cancela.
    cancelarEnElServidor();
    generacion += 1;
    email = null;
    consultas.clear();
    tienda.enviar({ tipo: 'VOLVER' });
  }

  /**
   * Pide al servidor cancelar la sesión sin esperar la respuesta ni fallar si
   * no llega: se usa cuando el cliente ya la dio por perdida. Idempotente.
   */
  function cancelarEnElServidor(): void {
    void api
      .fetch('/auth/logout', { method: 'POST', terminaSesion: false })
      .catch(() => undefined);
  }

  /**
   * Cierra el ciclo de una sesión que ya no sirve: primero se descarta la
   * caché y luego se avisa a la máquina. Solo si la máquina va a aceptar el
   * evento; si no, no se toca nada (p. ej. un 401 tardío).
   */
  function cerrarCon(evento: EventoSesion): void {
    const actual = tienda.obtener();
    if (Object.is(reducir(actual, evento), actual)) return;
    generacion += 1;
    consultas.clear();
    tienda.enviar(evento);
  }

  function terminar(motivo: MotivoSalida): void {
    const correo = email;
    cerrarCon(
      MOTIVOS_CON_CORREO.includes(motivo) && correo !== null
        ? { tipo: 'TERMINAR', motivo, email: correo }
        : { tipo: 'TERMINAR', motivo },
    );
    if (tienda.obtener().fase === 'ended') email = null;
  }

  async function cerrarSesion(): Promise<void> {
    if (!sesionViva(tienda.obtener())) return;
    // El servidor borra la sesión; el cliente no se vacía hasta que responde,
    // para que un logout tardío no pise una sesión nueva. Si no llega, la
    // persona igual sale: la cookie vence sola a las 8 h sin actividad.
    await api
      .fetch('/auth/logout', { method: 'POST', terminaSesion: false })
      .catch(() => undefined);
    email = null;
    cerrarCon({ tipo: 'CIERRE' });
  }

  function restaurar(): Promise<void> {
    if (tienda.obtener().fase !== 'restaurando') return Promise.resolve();
    restauracion ??= restaurarDelServidor();
    return restauracion;
  }

  async function restaurarDelServidor(): Promise<void> {
    const vigente = () => tienda.obtener().fase === 'restaurando';
    const fallida = (motivo?: 'sin_acceso') =>
      tienda.enviar(
        motivo === undefined
          ? { tipo: 'RESTAURACION_FALLIDA' }
          : { tipo: 'RESTAURACION_FALLIDA', motivo },
      );

    // Mismos reintentos que las consultas: un fallo de red o un 5xx pasajero
    // no debe mandar a quien recargó otra vez al login.
    for (let intentos = 1; ; intentos += 1) {
      try {
        const contexto = await api.fetch('/auth/contexto', {
          schema: contextoSesion,
          terminaSesion: false,
        });
        if (!vigente()) return;
        consultas.setQueryData(
          claveContexto(tienda.obtener().epoca + 1),
          contexto,
        );
        tienda.enviar({
          tipo: 'RESTAURADA_SESION',
          usuario: contexto.usuario,
          empresaId: contexto.empresa.id,
        });
        // La pantalla ya está lista: saber cuántas empresas hay no la bloquea.
        await conocerEmpresas();
        return;
      } catch (causa) {
        if (!vigente()) return;
        if (causa instanceof ApiError && causa.statusCode === 403) {
          return fallida('sin_acceso');
        }
        if (causa instanceof ApiError && causa.statusCode === 401) break;
        if (!reintentarConsulta(intentos - 1, causa)) return fallida();
      }
    }

    // 401: no hay sesión, o la hay pero sin empresa elegida (el contexto exige
    // empresa). Esa segunda se distingue porque todavía puede listar empresas.
    try {
      const empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        terminaSesion: false,
      });
      if (!vigente()) return;
      if (empresas.length > 0) {
        tienda.enviar({ tipo: 'RESTAURADA_SELECCION', empresas });
        return;
      }
    } catch {
      // Sin sesión (401) o sin red: nada que retomar.
    }
    if (vigente()) fallida();
  }

  /**
   * Tras restaurar una sesión con empresa, pregunta cuántas empresas tiene la
   * persona para que `puedeCambiarEmpresa` sea correcto. Si falla (red, 5xx,
   * 401) no pasa nada: el cambio simplemente no se ofrece y la sesión sigue.
   */
  async function conocerEmpresas(): Promise<void> {
    const desde = empezar();
    const { epoca } = tienda.obtener();
    try {
      const empresas = await api.fetch('/auth/empresas', {
        schema: listaEmpresasDisponibles,
        terminaSesion: false,
      });
      if (generacion !== desde) return;
      tienda.enviar({
        tipo: 'EMPRESAS_CONOCIDAS',
        epoca,
        varias: empresas.length > 1,
      });
    } catch {
      // Se queda en `false`; no es motivo para tocar la sesión.
    }
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
    abrirSesionDeInvitacion,
    cambiarEmpresa,
    regresarSinCambiar,
    refrescarEmpresas,
    volverAlInicio,
    cerrarSesion,
    reintentarContexto,
    consumirFin,
    terminar,
    restaurar,
  };
}
