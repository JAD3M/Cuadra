import { ApiProperty } from '@nestjs/swagger';
import type { TasaDeDesacuerdo } from '../sombra.service';

/** Respuesta de `GET /medicion/desacuerdo` (historia 9.1). */
export class TasaDeDesacuerdoDto implements TasaDeDesacuerdo {
  @ApiProperty({
    example: 240,
    description: 'Propuestas de la regla 1 que Cuadra hizo en la empresa.',
  })
  propuestas!: number;

  @ApiProperty({
    example: 200,
    description:
      'Las que el equipo ya trató: confirmó, rechazó, desmarcó o reabrió.',
  })
  tratadas!: number;

  @ApiProperty({
    example: 8,
    description: 'Las tratadas en las que el equipo no estuvo de acuerdo.',
  })
  desacuerdos!: number;

  @ApiProperty({
    example: '0.0400',
    nullable: true,
    type: String,
    description:
      '`desacuerdos / tratadas` con cuatro decimales, como texto; `null` si todavía no hay propuestas tratadas.',
  })
  tasa!: string | null;
}
