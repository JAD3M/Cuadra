// Espejo de src/bandeja/dto/bandeja.dto.ts (backend). Vive aparte de tipos.ts
// porque el backend lo declara en el DTO de la bandeja, no en
// src/common/entities/tipos.ts. tests/dominio/deriva.test.ts falla si algún
// valor, el orden o un export cambia en el backend. El orden importa.

export const ESTADOS_BANDEJA = [
  'conciliado',
  'sugerencia',
  'sin_match',
] as const;
export type EstadoBandeja = (typeof ESTADOS_BANDEJA)[number];

/** Sin `estado`, la bandeja muestra lo que espera revisión. */
export const ESTADOS_POR_DEFECTO: readonly EstadoBandeja[] = [
  'sugerencia',
  'sin_match',
];
export const LIMITE_POR_DEFECTO = 50;
export const LIMITE_MAXIMO = 200;
