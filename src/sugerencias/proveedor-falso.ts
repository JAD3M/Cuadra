// src/sugerencias/proveedor-falso.ts
import {
  type EntradaSugerencia,
  ProveedorSugerencia,
  type RespuestaSugerencia,
} from './proveedor-sugerencia';

/**
 * Qué responde el doble a una llamada: una respuesta, un error que lanza, o
 * una función que decide según la entrada. `unknown` permite probar respuestas
 * malformadas, que un proveedor real tipado no produciría.
 */
export type GuionFalso = unknown;

/**
 * Doble de pruebas del puerto. Sin red: responde lo que el guion diga (en
 * orden, y la última se repite) y guarda cada entrada recibida para que los
 * tests afirmen sobre lo que saldría a la red.
 */
export class ProveedorFalso extends ProveedorSugerencia {
  readonly activo: boolean;
  readonly modelo: string;
  /** Lo que el servicio le mandó, en orden. */
  readonly recibidas: EntradaSugerencia[] = [];
  private readonly guion: unknown[];
  private siguiente = 0;

  constructor(
    guion: GuionFalso = { decision: 'ninguno' },
    opciones: { modelo?: string; activo?: boolean } = {},
  ) {
    super();
    this.guion = Array.isArray(guion) ? guion : [guion];
    this.modelo = opciones.modelo ?? 'modelo-falso';
    this.activo = opciones.activo ?? true;
  }

  get llamadas(): number {
    return this.recibidas.length;
  }

  sugerir(entrada: EntradaSugerencia): Promise<RespuestaSugerencia> {
    this.recibidas.push(entrada);
    const paso = this.guion[Math.min(this.siguiente++, this.guion.length - 1)];
    try {
      const resultado =
        typeof paso === 'function'
          ? (paso as (e: EntradaSugerencia) => unknown)(entrada)
          : paso;
      if (resultado instanceof Error) return Promise.reject(resultado);
      return Promise.resolve(resultado as RespuestaSugerencia);
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
