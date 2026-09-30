// src/sugerencias/proveedor-sugerencia.ts

/**
 * CU-17. Puerto hacia el modelo que sugiere un cruce cuando el motor de reglas
 * no pudo decidir. El motor decide; el modelo solo elige entre los candidatos
 * que el motor ya considera compatibles, y nunca cierra un caso. Como
 * `ProveedorTolerancia`, es una clase abstracta que sirve de token de Nest:
 * el módulo enlaza la implementación y el servicio no conoce al proveedor.
 */

/**
 * Lo único que sale de la casa hacia el modelo. Sin RFC, UUID, XML ni ids: el
 * candidato se identifica con una etiqueta opaca (C1..CN) que solo el servidor
 * sabe traducir de vuelta a un CFDI.
 */
export interface EntradaSugerencia {
  movimiento: {
    /** 'YYYY-MM-DD'. */
    fecha: string;
    /** Texto decimal con signo: nunca `number`. */
    monto: string;
    moneda: string;
    descripcion: string;
    referencia: string | null;
  };
  candidatos: CandidatoEntrada[];
}

export interface CandidatoEntrada {
  /** "C1".."CN", asignada tras ordenar el conjunto. */
  etiqueta: string;
  serieFolio: string;
  total: string;
  /** 'YYYY-MM-DD'. */
  fecha: string;
  receptor: string;
}

export const CONFIANZAS = ['alta', 'media', 'baja'] as const;
export type Confianza = (typeof CONFIANZAS)[number];

/**
 * Lo que dice el modelo. 'sin_respuesta' es una negativa o una respuesta
 * truncada (refusal, max_tokens): no es un fallo del proveedor, es "sin
 * sugerencia". El contrato malformado no tiene variante: el adaptador lo
 * reporta con `ErrorProveedorSugerencia`.
 */
export type RespuestaSugerencia =
  | {
      decision: 'sugerir';
      candidato: string;
      confianza: Confianza;
      explicacion: string;
    }
  | { decision: 'ninguno' }
  | { decision: 'sin_respuesta' };

/** El proveedor falló (red, tiempo, API, contrato roto): se reintenta en otra corrida. */
export class ErrorProveedorSugerencia extends Error {
  constructor(mensaje: string, options?: { cause?: unknown }) {
    super(mensaje, options);
    this.name = 'ErrorProveedorSugerencia';
  }
}

export abstract class ProveedorSugerencia {
  /** Si es false, el servicio ni lee la base: no hay a quién preguntar. */
  abstract readonly activo: boolean;
  /** Entra en la huella de la entrada: otro modelo, otra pregunta. */
  abstract readonly modelo: string;
  abstract sugerir(entrada: EntradaSugerencia): Promise<RespuestaSugerencia>;
}

/** Función apagada por configuración: nunca se le pregunta nada. */
export class ProveedorDesactivado extends ProveedorSugerencia {
  readonly activo = false;
  readonly modelo = 'desactivado';

  sugerir(): Promise<RespuestaSugerencia> {
    return Promise.reject(
      new ErrorProveedorSugerencia(
        'La sugerencia por IA está desactivada: no se debe llamar al proveedor',
      ),
    );
  }
}
