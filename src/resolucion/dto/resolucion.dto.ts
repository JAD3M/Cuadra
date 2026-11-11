import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
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
      'Ids de las propuestas que la persona dejó marcadas (hasta 500, sin repetir; pueden ir vacías solo si viene `desmarcadas` con alguna). El lote no pide motivo.',
  })
  // Un uuid en mayúsculas es el mismo id: se normaliza antes de validar para que
  // `ArrayUnique` lo vea repetido y la regla de choques compare lo mismo que la base.
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(MAXIMO_LOTE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAXIMO_LOTE,
    description:
      'Ids de las propuestas que venían marcadas y la persona desmarcó (hasta 500, sin repetir, ninguna también en `ids`). Solo se anotan como evidencia del modo sombra: no cambian el estado de nada. Con `ids` vacío el lote no confirma nada y solo anota esto.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(MAXIMO_LOTE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  desmarcadas?: string[];
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
