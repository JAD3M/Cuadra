import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  RAZONES_OMISION_LOTE,
  type RazonOmisionLote,
} from '../../common/entities/tipos';

export const MOTIVO_MAXIMO = 500;

/** Tope de propuestas por lote (5.3): más pide dividirlo, no se corta en silencio. */
export const MAXIMO_LOTE = 500;

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
  @ApiProperty({
    description:
      'Primera factura de la decisión (id ascendente); se conserva para clientes de una sola factura.',
  })
  cfdiId: string;
  @ApiProperty({
    type: [String],
    description:
      'Todas las facturas de la decisión, en id ascendente (un grupo tiene varias).',
  })
  cfdiIds: string[];
  @ApiProperty() movimientoId: string;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
  @ApiProperty({ nullable: true, type: String }) confirmadaAt: string | null;
  @ApiProperty({ type: [String] }) rechazadasAutomaticamente: string[];
}

export class LoteDto {
  @ApiProperty({
    type: [String],
    maxItems: MAXIMO_LOTE,
    description:
      'Ids de las propuestas que la persona dejó marcadas (1 a 500, sin repetir). El lote no pide motivo.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_LOTE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}

export class OmisionDeLoteDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: RAZONES_OMISION_LOTE }) razon: RazonOmisionLote;
}

export class LoteRespuestaDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Identificador del lote (también queda en cada decisión y en su bitácora). null si no se confirmó ninguna.',
  })
  loteId: string | null;
  @ApiProperty({ type: [String], description: 'Ids confirmadas.' })
  confirmadas: string[];
  @ApiProperty({
    type: [OmisionDeLoteDto],
    description: 'Las que quedaron fuera, cada una con su razón.',
  })
  omitidas: OmisionDeLoteDto[];
}
