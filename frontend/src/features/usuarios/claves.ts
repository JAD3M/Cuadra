import type { EpocaBandeja } from '@/features/bandeja/claves';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de Usuarios. Como en la bandeja y la tolerancia, la
// segunda posición es la época de la sesión (un contador, nunca un token): al
// cambiar de empresa o de cuenta ninguna lista anterior se sirve. Sin sesión
// lista la época es `null` y la consulta está apagada. Invitar, reenviar y
// cancelar invalidan `pendientes`.

export const clavesUsuarios = {
  pendientes: (epoca: EpocaBandeja) =>
    ['usuarios', epoca, 'invitaciones'] as const,
};
