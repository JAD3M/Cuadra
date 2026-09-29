import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MOTIVO_MAXIMO = 500;

export class RechazarDto {
  @ApiPropertyOptional({
    maxLength: MOTIVO_MAXIMO,
    description:
      'Por qué se rechaza. Si se omite (o va vacío) se conserva el motivo de la propuesta.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const recortado = value.trim();
    return recortado === '' ? undefined : recortado;
  })
  @IsString()
  @MaxLength(MOTIVO_MAXIMO)
  motivo?: string;
}

export class ResolucionRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'rechazada' }) estado: string;
  @ApiProperty() cfdiId: string;
  @ApiProperty() movimientoId: string;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
  @ApiProperty({ nullable: true, type: String }) confirmadaAt: string | null;
  @ApiProperty({ type: [String] }) rechazadasAutomaticamente: string[];
}
