import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ACCIONES_BITACORA } from '../../common/entities/tipos';
import {
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
} from '../../bandeja/dto/bandeja.dto';

/**
 * Query de `GET /bitacora`. El ValidationPipe global no convierte de forma
 * implícita: pagina y limite declaran su `@Type`. `desde` es inclusivo y
 * `hasta` exclusivo: [desde, hasta).
 */
export class ConsultaBitacoraDto {
  @ApiPropertyOptional({ maxLength: 64, example: 'conciliaciones' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entidad?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entidadId?: string;

  @ApiPropertyOptional({ enum: ACCIONES_BITACORA })
  @IsOptional()
  @IsIn(ACCIONES_BITACORA)
  accion?: (typeof ACCIONES_BITACORA)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-09-30T00:00:00Z',
    description: 'ISO 8601, inclusivo.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00Z',
    description: 'ISO 8601, exclusivo.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  hasta?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMITE_MAXIMO,
    default: LIMITE_POR_DEFECTO,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limite?: number;
}

export class UsuarioBitacoraDto {
  @ApiProperty() nombre: string;
  @ApiProperty() email: string;
}

/** Un evento de la bitácora; `datos` se devuelve tal como se guardó. */
export class EventoHistorialDto {
  @ApiProperty() id: string;
  @ApiProperty() entidad: string;
  @ApiProperty() entidadId: string;
  @ApiProperty({ enum: ACCIONES_BITACORA }) accion: string;
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  datos: Record<string, unknown> | null;
  @ApiProperty({ example: '2026-09-30T16:00:00.000Z' }) createdAt: string;
  @ApiProperty({
    nullable: true,
    type: UsuarioBitacoraDto,
    description: 'Null cuando lo hizo el sistema (motor de reglas).',
  })
  usuario: UsuarioBitacoraDto | null;
}

/** El listado general suma el origen de la petición. */
export class EventoBitacoraDto extends EventoHistorialDto {
  @ApiProperty({ nullable: true, type: String, example: '203.0.113.7' })
  ip: string | null;
  @ApiProperty({ nullable: true, type: String }) userAgent: string | null;
}

export class RespuestaHistorialDto {
  @ApiProperty({ type: [EventoHistorialDto] }) datos: EventoHistorialDto[];
}

export class RespuestaBitacoraDto {
  @ApiProperty({ type: [EventoBitacoraDto] }) datos: EventoBitacoraDto[];
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
  @ApiProperty({ description: 'Filas que cumplen el filtro, sin paginar.' })
  total: number;
}
