import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MOTIVO_MAXIMO } from './resolucion.dto';

/** Historia 5.7: el motivo es obligatorio y sin él se rechaza (400). */
export class ReabrirDto {
  @ApiProperty({
    maxLength: MOTIVO_MAXIMO,
    example: 'Confirmé el CFDI equivocado',
    description: 'Por qué se reabre la confirmación. Queda en la bitácora.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MOTIVO_MAXIMO)
  motivo: string;
}

export class ReabrirRespuestaDto {
  @ApiProperty({ description: 'Id de la decisión reabierta.' }) id: string;
  @ApiProperty({ example: 'reabierta' }) estado: string;
  @ApiProperty() movimientoId: string;
  @ApiProperty({
    type: [String],
    description: 'Facturas de la confirmación (id ascendente).',
  })
  cfdiIds: string[];
  @ApiProperty() motivo: string;
}
