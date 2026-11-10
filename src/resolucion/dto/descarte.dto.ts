import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MOTIVO_MAXIMO } from './resolucion.dto';

/** Historia 5.6: el motivo es obligatorio y sin él se rechaza (400). */
export class DescartarDto {
  @ApiProperty({
    maxLength: MOTIVO_MAXIMO,
    example: 'Comisión bancaria',
    description:
      'Por qué el movimiento no es de ningún cliente. Se guarda para auditar los descartes (SM-2).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MOTIVO_MAXIMO)
  motivo: string;
}

export class DescarteRespuestaDto {
  @ApiProperty({ description: 'Id de la decisión de descarte.' }) id: string;
  @ApiProperty() movimientoId: string;
  @ApiProperty({ example: 'descartada', enum: ['descartada', 'reabierta'] })
  estado: string;
  @ApiProperty({ description: 'Motivo del descarte.' }) motivo: string;
}
