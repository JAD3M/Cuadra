import { z } from 'zod';

// Contrato de la medición (historia 9.1, FR-36): `GET /medicion/desacuerdo`.
// La tasa viaja como texto con cuatro decimales ("0.0400") y así se queda:
// ningún valor pasa por `number` para mostrarse.

const contador = z.int().min(0);

/** Entre 0 y 1 con cuatro decimales, como la entrega el servidor. */
const tasa = z
  .string()
  .regex(/^(?:0\.\d{4}|1\.0000)$/, 'Tasa decimal de 0 a 1');

export const tasaDeDesacuerdo = z.object({
  /** Propuestas de la regla 1 que Cuadra hizo en la empresa. */
  propuestas: contador,
  /** Las que el equipo ya trató: confirmó, rechazó, desmarcó o reabrió. */
  tratadas: contador,
  desacuerdos: contador,
  /** `null` mientras no haya propuestas tratadas. */
  tasa: tasa.nullable(),
});

export type TasaDeDesacuerdo = z.infer<typeof tasaDeDesacuerdo>;
