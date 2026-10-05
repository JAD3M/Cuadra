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
 * Estado de la sesión que consume la aplicación. Nunca contiene un token.
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
  | { status: 'anonymous' }
  | {
      status: 'selecting';
      origen: OrigenSeleccion;
      usuario: Usuario;
      empresas: EmpresaDisponible[];
      /**
       * Empresa de la sesión viva durante un cambio (`origen: 'cambio'`).
       * Ausente en el login o si su contexto todavía no se conoce.
       */
      empresaActual?: EmpresaContexto;
    }
  | { status: 'loading'; restaurarOrigen: boolean }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      contexto: SessionContext;
      puedeCambiarEmpresa: boolean;
      restaurarOrigen: boolean;
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
   * Canjea el token de selección por uno de sesión para la empresa dada. Con
   * un 401 (la selección venció) la sesión termina y además rechaza; con un
   * 403 refresca la lista de empresas y rechaza para que la pantalla muestre
   * el mensaje.
   */
  elegirEmpresa(empresaId: string): Promise<void>;
  /**
   * Cambio directo de empresa: con el token de selección que se conserva pide
   * la lista y pasa a `selecting` con origen `cambio`. La sesión actual sigue
   * viva y la caché no se toca. Con un fallo de red o 5xx rechaza y la sesión
   * sigue en `ready`.
   */
  cambiarEmpresa(): Promise<void>;
  /** Abandona el cambio de empresa y vuelve a la sesión viva, sin recargar. */
  regresarSinCambiar(): void;
  /**
   * Vuelve a pedir la lista de empresas durante la selección. Si la lista
   * quedó vacía la sesión termina con `sin_empresas`.
   */
  refrescarEmpresas(): Promise<void>;
  /** «Cambiar de cuenta»: descarta todo y vuelve a `anonymous`, sin correo. */
  volverAlInicio(): void;
  /**
   * Cierre voluntario: descarta tokens y caché y pasa a `ended` con
   * `cierre_voluntario`. No hace ninguna petición: la API no revoca tokens.
   */
  cerrarSesion(): void;
  /** Vuelve a pedir el contexto cuando el estado es `unavailable`. */
  reintentarContexto(): void;
  /**
   * Pasa de `ended` a `anonymous`. La pantalla de acceso lo llama una vez que
   * leyó el motivo y el correo, para que el aviso se muestre una sola vez.
   */
  consumirFin(): void;
}
