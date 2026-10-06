// Aviso (nunca bloqueo) de que el usuario escribió el número de cuenta entero.

/** M5: 10 o más dígitos CONSECUTIVOS; separadores o asteriscos lo rompen. */
const DIEZ_DIGITOS_SEGUIDOS = /\d{10,}/;

/**
 * El valor se evalúa y se descarta: no se guarda, no se registra y no se
 * devuelve. Solo decide si se muestra el aviso de «escribe solo los últimos
 * dígitos».
 */
export const pareceCuentaCompleta = (valor: string): boolean =>
  DIEZ_DIGITOS_SEGUIDOS.test(valor);
