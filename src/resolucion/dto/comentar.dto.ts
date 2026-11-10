import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { COMENTARIO_MAXIMO } from '../../conciliacion/decision-comentario.entity';

/** Historia 5.9: un comentario vacío se rechaza con un mensaje claro (400). */
export class ComentarDto {
  @ApiProperty({
    maxLength: COMENTARIO_MAXIMO,
    example: 'Creo que esta factura no corresponde a este pago',
    description: 'Texto libre. Queda en el caso y en la bitácora; no se edita.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El comentario debe ser texto' })
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @MaxLength(COMENTARIO_MAXIMO, {
    message: `El comentario no puede pasar de ${COMENTARIO_MAXIMO} caracteres`,
  })
  texto: string;
}

export class ComentarioDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Id de la decisión comentada.' })
  decisionId: string;
  @ApiProperty() texto: string;
  @ApiProperty({ description: 'Nombre de quien comentó.' }) por: string;
  @ApiProperty({ description: 'Fecha y hora (ISO 8601).' }) fecha: string;
}
