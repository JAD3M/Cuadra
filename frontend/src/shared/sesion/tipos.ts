import type { MotivoFinSesion } from '@/shared/api';
import type {
  ContextoSesion,
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
  /** Canjea el token de selección por uno de sesión para la empresa dada. */
  elegirEmpresa(empresaId: string): Promise<void>;
  /** «Cambiar de cuenta»: descarta todo y vuelve a `anonymous`, sin correo. */
  volverAlInicio(): void;
}
