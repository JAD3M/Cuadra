import type { EmpresaDisponible, Usuario } from '@/shared/api/contratos';
import type { MotivoSalida } from './tipos';

/**
 * Máquina de estados de la sesión: reductor puro y una tienda mínima.
 *
 * Aquí NO hay tokens: la sesión es una cookie `httpOnly` que el navegador
 * guarda y JavaScript no puede leer. Este estado solo dice en qué fase está
 * la sesión.
 *
 * Un evento que no corresponde a la fase actual se ignora y devuelve el mismo
 * objeto: así cada transición es idempotente y la tienda no notifica.
 */
export type EstadoInterno =
  | {
      /**
       * Arranque en frío: se le pregunta al servidor si la cookie todavía
       * vale (recarga de la página). Nada de la sesión es visible aún.
       */
      fase: 'restaurando';
      epoca: number;
      empresaPrevia: null;
    }
  | {
      fase: 'anonymous';
      epoca: number;
      /** Empresa de la sesión anterior; solo en memoria (ver SA-2). */
      empresaPrevia: string | null;
    }
  | {
      fase: 'selecting';
      origen: 'login';
      epoca: number;
      /** `null` al retomar la elección tras una recarga: nadie lo informa. */
      usuario: Usuario | null;
      empresas: EmpresaDisponible[];
      empresaPrevia: string | null;
    }
  | {
      fase: 'selecting';
      origen: 'cambio';
      epoca: number;
      usuario: Usuario | null;
      empresas: EmpresaDisponible[];
      /** Empresa de la sesión viva que se está cambiando. */
      empresaId: string;
      restaurarOrigen: boolean;
      /** ¿Tiene el usuario más de una empresa? Decide si puede cambiar. */
      varias: boolean;
    }
  | {
      fase: 'sesion';
      epoca: number;
      usuario: Usuario | null;
      empresaId: string;
      restaurarOrigen: boolean;
      varias: boolean;
    }
  | {
      fase: 'ended';
      epoca: number;
      motivo: MotivoSalida;
      email?: string;
      empresaPrevia: string | null;
    };

export type FaseSesion = EstadoInterno['fase'];

export type EventoSesion =
  | {
      tipo: 'RESTAURADA_SESION';
      usuario: Usuario;
      empresaId: string;
    }
  | { tipo: 'RESTAURADA_SELECCION'; empresas: EmpresaDisponible[] }
  | { tipo: 'RESTAURACION_FALLIDA'; motivo?: 'sin_acceso' }
  | { tipo: 'LOGIN_OK'; usuario: Usuario; empresas: EmpresaDisponible[] }
  | { tipo: 'SELECCION_OK'; empresaId: string }
  | { tipo: 'CAMBIO_OK'; empresas: EmpresaDisponible[] }
  | { tipo: 'REGRESAR' }
  | { tipo: 'CONSUMIR' }
  | { tipo: 'TERMINAR'; motivo: MotivoSalida; email?: string }
  | { tipo: 'CIERRE' }
  | { tipo: 'VOLVER' }
  | { tipo: 'EMPRESAS_REFRESCADAS'; empresas: EmpresaDisponible[] };

export const ESTADO_INICIAL: EstadoInterno = {
  fase: 'anonymous',
  epoca: 0,
  empresaPrevia: null,
};

/** Estado de arranque de la aplicación: primero se pregunta al servidor. */
export const ESTADO_ARRANQUE: EstadoInterno = {
  fase: 'restaurando',
  epoca: 0,
  empresaPrevia: null,
};

/** Empresa de la sesión viva, o `null` si no hay una. */
export function empresaVigente(estado: EstadoInterno): string | null {
  if (estado.fase === 'sesion') return estado.empresaId;
  if (estado.fase === 'selecting' && estado.origen === 'cambio') {
    return estado.empresaId;
  }
  return null;
}

/** ¿Hay una sesión viva (con empresa elegida)? */
export function sesionViva(estado: EstadoInterno): boolean {
  return empresaVigente(estado) !== null;
}

function previaDe(estado: EstadoInterno): string | null {
  return 'empresaPrevia' in estado ? estado.empresaPrevia : null;
}

function terminar(
  estado: EstadoInterno,
  evento: Extract<EventoSesion, { tipo: 'TERMINAR' }>,
): EstadoInterno {
  const { motivo } = evento;
  const base = { fase: 'ended', epoca: estado.epoca, motivo } as const;

  if (motivo === 'seleccion_vencida') {
    if (estado.fase !== 'selecting' || estado.origen !== 'login') return estado;
    return {
      ...base,
      email: evento.email,
      empresaPrevia: estado.empresaPrevia,
    };
  }

  if (motivo === 'sin_empresas') {
    // La lista quedó vacía: sirve desde cualquier punto con sesión o selección.
    if (estado.fase === 'anonymous' || estado.fase === 'ended') return estado;
    return {
      ...base,
      email: evento.email,
      empresaPrevia:
        estado.fase === 'selecting' && estado.origen === 'login'
          ? estado.empresaPrevia
          : empresaVigente(estado),
    };
  }

  const empresaId = empresaVigente(estado);
  if (empresaId === null) return estado;

  if (motivo === 'sesion_expirada' || motivo === 'sin_acceso') {
    // Sin acceso a la empresa no hay a dónde volver: no se recuerda.
    return {
      ...base,
      empresaPrevia: motivo === 'sin_acceso' ? null : empresaId,
    };
  }
  if (motivo === 'reingreso') {
    return { ...base, email: evento.email, empresaPrevia: empresaId };
  }
  // `cierre_voluntario` tiene su propio evento (CIERRE).
  return estado;
}

/** Transición pura. Los eventos inválidos para la fase se ignoran. */
export function reducir(
  estado: EstadoInterno,
  evento: EventoSesion,
): EstadoInterno {
  switch (evento.tipo) {
    case 'RESTAURADA_SESION':
      if (estado.fase !== 'restaurando') return estado;
      return {
        fase: 'sesion',
        epoca: estado.epoca + 1,
        usuario: evento.usuario,
        empresaId: evento.empresaId,
        // Es la misma sesión de antes de recargar: la pantalla pedida vale.
        restaurarOrigen: true,
        // El servidor no dice cuántas empresas tiene quien ya eligió una.
        varias: false,
      };

    case 'RESTAURADA_SELECCION':
      if (estado.fase !== 'restaurando') return estado;
      return {
        fase: 'selecting',
        origen: 'login',
        epoca: estado.epoca,
        usuario: null,
        empresas: evento.empresas,
        empresaPrevia: null,
      };

    case 'RESTAURACION_FALLIDA':
      if (estado.fase !== 'restaurando') return estado;
      if (evento.motivo === 'sin_acceso') {
        return {
          fase: 'ended',
          epoca: estado.epoca,
          motivo: 'sin_acceso',
          empresaPrevia: null,
        };
      }
      return { fase: 'anonymous', epoca: estado.epoca, empresaPrevia: null };

    case 'LOGIN_OK':
      if (estado.fase !== 'anonymous' && estado.fase !== 'ended') return estado;
      return {
        fase: 'selecting',
        origen: 'login',
        epoca: estado.epoca,
        usuario: evento.usuario,
        empresas: evento.empresas,
        empresaPrevia: previaDe(estado),
      };

    case 'SELECCION_OK': {
      if (estado.fase !== 'selecting') return estado;
      const previa = estado.origen === 'login' ? estado.empresaPrevia : null;
      return {
        fase: 'sesion',
        epoca: estado.epoca + 1,
        usuario: estado.usuario,
        empresaId: evento.empresaId,
        // Un acceso nuevo (sin sesión previa que recordar) puede ir al destino
        // pedido; tras una expiración solo si es la misma empresa (SA-2). Un
        // cambio de empresa nunca: va a `/bandeja`.
        restaurarOrigen:
          estado.origen === 'login' &&
          (previa === null || previa === evento.empresaId),
        varias: estado.empresas.length > 1,
      };
    }

    case 'CAMBIO_OK':
      if (estado.fase !== 'sesion') return estado;
      return {
        fase: 'selecting',
        origen: 'cambio',
        epoca: estado.epoca,
        usuario: estado.usuario,
        empresas: evento.empresas,
        empresaId: estado.empresaId,
        restaurarOrigen: estado.restaurarOrigen,
        varias: evento.empresas.length > 1,
      };

    case 'REGRESAR':
      if (estado.fase !== 'selecting' || estado.origen !== 'cambio') {
        return estado;
      }
      return {
        fase: 'sesion',
        epoca: estado.epoca,
        usuario: estado.usuario,
        empresaId: estado.empresaId,
        restaurarOrigen: estado.restaurarOrigen,
        varias: estado.varias,
      };

    case 'CONSUMIR':
      if (estado.fase !== 'ended') return estado;
      return {
        fase: 'anonymous',
        epoca: estado.epoca,
        empresaPrevia: estado.empresaPrevia,
      };

    case 'TERMINAR':
      return terminar(estado, evento);

    case 'CIERRE':
      if (!sesionViva(estado)) return estado;
      return {
        fase: 'ended',
        epoca: estado.epoca,
        motivo: 'cierre_voluntario',
        empresaPrevia: null,
      };

    case 'VOLVER':
      if (estado.fase !== 'selecting' || estado.origen !== 'login') {
        return estado;
      }
      // «Cambiar de cuenta» no borra la empresa previa: si la sesión expiró,
      // otra cuenta no hereda el destino de la anterior (SA-2).
      return {
        fase: 'anonymous',
        epoca: estado.epoca,
        empresaPrevia: estado.empresaPrevia,
      };

    case 'EMPRESAS_REFRESCADAS':
      if (estado.fase !== 'selecting') return estado;
      if (estado.origen === 'cambio') {
        return {
          ...estado,
          empresas: evento.empresas,
          varias: evento.empresas.length > 1,
        };
      }
      return { ...estado, empresas: evento.empresas };
  }
}

/** Tienda externa mínima, pensada para `useSyncExternalStore`. */
export interface Tienda<Estado, Evento> {
  obtener(): Estado;
  enviar(evento: Evento): void;
  suscribir(oyente: () => void): () => void;
}

export function crearTienda<Estado, Evento>(
  reductor: (estado: Estado, evento: Evento) => Estado,
  inicial: Estado,
): Tienda<Estado, Evento> {
  let actual = inicial;
  const oyentes = new Set<() => void>();
  return {
    obtener: () => actual,
    enviar(evento) {
      const siguiente = reductor(actual, evento);
      if (Object.is(siguiente, actual)) return;
      actual = siguiente;
      for (const oyente of [...oyentes]) oyente();
    },
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
  };
}
