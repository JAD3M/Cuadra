import type { MotivoFinSesion } from '@/shared/api';
import type {
  ContextoSesion,
  EmpresaContexto,
  EmpresaDisponible,
  SolicitudLogin,
  Usuario,
} from '@/shared/api/contratos';

/** Contexto de la sesión activa: usuario, empresa y roles (`/auth/contexto`). */
export type SessionContext = ContextoSesion;

/**
 * Por qué terminó una sesión (o un intento de entrar). `sesion_expirada`,
 * `sin_acceso` y `cierre_voluntario` son los de la especificación; `reingreso`
 * (la ficha de selección venció durante un cambio de empresa),
 * `seleccion_vencida` (venció antes de elegir empresa) y `sin_empresas` (la
 * lista quedó vacía) son internos y se muestran como avisos de `/login`.
 */
export type MotivoSalida =
  | MotivoFinSesion
  | 'cierre_voluntario'
  | 'reingreso'
  | 'seleccion_vencida'
  | 'sin_empresas';

/** De dónde viene el paso de elección de empresa. */
export type OrigenSeleccion = 'login' | 'cambio';

/**
 * Estado de la sesión que consume la aplicación. Nunca contiene un token: la
 * sesión es una cookie `httpOnly` que JavaScript no lee.
 * - `restoring`: arranque en frío (recarga); se le pregunta al servidor si la
 *   cookie todavía vale. No es todavía anónimo ni hay sesión.
 * - `anonymous`: no hay sesión (arranque en frío o «Cambiar de cuenta»).
 * - `selecting`: credenciales válidas; falta elegir empresa. Con
 *   `origen: 'cambio'` la sesión anterior sigue viva.
 * - `loading`: hay sesión y todavía no se conoce el contexto.
 * - `unavailable`: hay sesión, pero la primera consulta del contexto falló
 *   por un motivo que no es de autorización (red, 5xx, contrato).
 * - `ready`: hay usuario, empresa y roles.
 * - `ended`: la sesión terminó; `email` solo viaja cuando se rellena el campo.
 *
 * `restaurarOrigen` indica si, tras una expiración, se volvió a elegir la
 * misma empresa y por lo tanto se puede volver a la pantalla de origen.
 */
export type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | {
      status: 'selecting';
      origen: OrigenSeleccion;
      /** `null` al retomar la elección tras una recarga: nadie lo informa. */
      usuario: Usuario | null;
      empresas: EmpresaDisponible[];
      /**
       * Empresa de la sesión viva durante un cambio (`origen: 'cambio'`).
       * Ausente en el login o si su contexto todavía no se conoce.
       */
      empresaActual?: EmpresaContexto;
      /**
       * Época de la sesión (misma noción que en `ready`). Solo sirve para
       * saber si al volver a `ready` se eligió otra empresa. Ausente en
       * estados construidos a mano.
       */
      epoca?: number;
    }
  | { status: 'loading'; restaurarOrigen: boolean }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      contexto: SessionContext;
      puedeCambiarEmpresa: boolean;
      restaurarOrigen: boolean;
      /**
       * Contador interno de la sesión: cambia al elegir empresa y al iniciar
       * otra sesión. No es un token ni un identificador; solo sirve para
       * aislar las consultas de una empresa de las de otra.
       */
      epoca: number;
    }
  | { status: 'ended'; motivo: MotivoSalida; email?: string };

/**
 * Acciones que las pantallas pueden pedir a la sesión. Su identidad es
 * estable, así que quien solo las usa no se vuelve a renderizar con el estado.
 */
export interface AccionesSesion {
  /**
   * Inicia sesión. Rechaza con `ApiError`, `NetworkError` o `ContratoError`
   * y deja el estado como estaba si falla.
   */
  iniciarSesion(credenciales: SolicitudLogin): Promise<void>;
  /**
   * Elige la empresa de la sesión: el servidor rota la cookie y devuelve el
   * contexto, que se aplica sin pedirlo otra vez. Con un 401 (la sesión sin
   * empresa venció) la sesión termina y además rechaza; con un 403 refresca la
   * lista de empresas y rechaza para que la pantalla muestre el mensaje.
   */
  elegirEmpresa(empresaId: string): Promise<void>;
  /**
   * Aceptar una invitación: el servidor ya puso la cookie de una sesión con
   * empresa. Pide el contexto con ella y entra, reemplazando cualquier sesión
   * anterior y vaciando su caché. Rechaza sin cambiar el estado si el
   * contexto falla.
   */
  abrirSesionDeInvitacion(): Promise<void>;
  /**
   * Cambio directo de empresa: pide la lista y pasa a `selecting` con origen
   * `cambio`. La sesión actual sigue viva y la caché no se toca. Con un fallo
   * de red o 5xx rechaza y la sesión sigue en `ready`. Con un 401 (la cookie
   * ya no vale) pide ingresar de nuevo.
   */
  cambiarEmpresa(): Promise<void>;
  /** Abandona el cambio de empresa y vuelve a la sesión viva, sin recargar. */
  regresarSinCambiar(): void;
  /**
   * Vuelve a pedir la lista de empresas durante la selección. Si la lista
   * quedó vacía la sesión termina con `sin_empresas`.
   */
  refrescarEmpresas(): Promise<void>;
  /**
   * «Cambiar de cuenta»: cancela la sesión sin empresa en el servidor, descarta
   * todo y vuelve a `anonymous`, sin correo.
   */
  volverAlInicio(): void;
  /**
   * Cierre voluntario: `POST /auth/logout` (el servidor borra la sesión),
   * luego descarta la caché y pasa a `ended` con `cierre_voluntario`. Si la
   * petición falla igual cierra en el cliente.
   */
  cerrarSesion(): Promise<void>;
  /** Vuelve a pedir el contexto cuando el estado es `unavailable`. */
  reintentarContexto(): void;
  /**
   * Pasa de `ended` a `anonymous`. La pantalla de acceso lo llama una vez que
   * leyó el motivo y el correo, para que el aviso se muestre una sola vez.
   */
  consumirFin(): void;
}
