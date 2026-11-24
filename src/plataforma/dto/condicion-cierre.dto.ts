import { ApiProperty } from '@nestjs/swagger';

/** Historia 9.5 (FR-37, SM-C1). Solo conteos y tasas: ningún id, monto ni RFC. */
export class CriterioUmbralDto {
  @ApiProperty({ example: 1000, description: 'El umbral del PRD.' })
  pide!: number;

  @ApiProperty({ description: 'Lo que hay hoy, de todas las empresas.' })
  hoy!: number;

  @ApiProperty({
    description: 'Cuántas faltan para el umbral; nunca negativa.',
  })
  falta!: number;

  @ApiProperty() cumple!: boolean;
}

export class CriteriosCondicionDto {
  @ApiProperty({
    type: CriterioUmbralDto,
    description: 'Propuestas de la regla 1, en todas las empresas.',
  })
  propuestas!: CriterioUmbralDto;

  @ApiProperty({
    type: CriterioUmbralDto,
    description: 'Empresas distintas con al menos una propuesta.',
  })
  empresas!: CriterioUmbralDto;

  @ApiProperty({
    type: CriterioUmbralDto,
    description: 'Meses calendario (UTC) distintos con al menos una propuesta.',
  })
  meses!: CriterioUmbralDto;
}

export class MedidaDeTasaDto {
  @ApiProperty({ description: 'Los casos sobre los que se mide.' })
  casos!: number;

  @ApiProperty() desacuerdos!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.0495',
    description:
      'Desacuerdos entre casos, con cuatro decimales; null sin casos (no un cero).',
  })
  tasa!: string | null;
}

export class TasaCondicionDto {
  @ApiProperty({
    type: MedidaDeTasaDto,
    description: 'Propuestas tratadas por las personas (definición de la 6.2).',
  })
  registradas!: MedidaDeTasaDto;

  @ApiProperty({
    type: MedidaDeTasaDto,
    description: 'Casos de la muestra mensual con marca; vale la última (9.4).',
  })
  muestra!: MedidaDeTasaDto;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['registradas', 'muestra'],
    description: 'La más alta de las dos; null si no hay ninguna.',
  })
  usada!: 'registradas' | 'muestra' | null;

  @ApiProperty({ type: String, nullable: true, example: '0.0495' })
  tasaUsada!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.0445',
    description: 'Cuánto pasa la tasa usada del máximo; 0.0000 si está dentro.',
  })
  exceso!: string | null;

  @ApiProperty({ example: '0.0050', description: 'El máximo del PRD (0.5 %).' })
  maxima!: string;

  @ApiProperty({
    description:
      'Dentro del máximo con la más alta de las dos. Sin una de las dos medidas no se cumple.',
  })
  cumple!: boolean;
}

export class CondicionCierreDto {
  @ApiProperty({
    description:
      'Solo informa: no activa nada. El cierre automático no existe en la v2.',
  })
  cumple!: boolean;

  @ApiProperty({ type: CriteriosCondicionDto })
  criterios!: CriteriosCondicionDto;

  @ApiProperty({ type: TasaCondicionDto })
  tasa!: TasaCondicionDto;
}
