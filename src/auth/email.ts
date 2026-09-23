/**
 * Forma canónica de un email en todo el sistema. La base la respalda con el
 * índice único sobre `lower(email)`; esto evita depender solo de él.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
