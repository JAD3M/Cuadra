/**
 * Compuerta: una promesa que se resuelve cuando la prueba la abre. Un
 * manejador de MSW la espera antes de responder, así la prueba observa el
 * estado intermedio (`subiendo`, `cargando`) sin retardos fijos y suelta la
 * respuesta cuando quiere. Abrirla más de una vez no hace nada.
 */
export interface Compuerta {
  /** Libera todas las respuestas que esperan en `promesa`. */
  abrir: () => void;
  promesa: Promise<void>;
}

export function crearCompuerta(): Compuerta {
  let abrir: () => void = () => undefined;
  const promesa = new Promise<void>((resolver) => {
    abrir = resolver;
  });
  return { abrir, promesa };
}
