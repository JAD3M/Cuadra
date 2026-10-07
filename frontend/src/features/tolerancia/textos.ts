import type { MotivoInvalido } from './validarTolerancia';

// Textos de la pantalla de Tolerancia, centralizados para que el copy no se
// disperse en los componentes. Los avisos compartidos (conexión, sin permiso,
// Reintentar) se reutilizan de la bandeja; aquí solo va lo propio.

/** Mensaje de cada motivo por el que un borrador no se puede guardar. */
export const MOTIVOS_INVALIDO: Readonly<Record<MotivoInvalido, string>> = {
  vacio: 'Escribe un valor.',
  formato: 'Escribe un número con punto decimal, por ejemplo 0.50.',
  rango: 'El valor debe estar entre 0 y 100.',
  decimales: 'Usa hasta 4 decimales.',
};
