import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';

export const ESTADOS_BANDEJA = [
  'conciliado',
  'sugerencia',
  'sin_match',
] as const;
export type EstadoBandeja = (typeof ESTADOS_BANDEJA)[number];

/** Sin `estado`, la bandeja muestra lo que espera revisión. */
export const ESTADOS_POR_DEFECTO: EstadoBandeja[] = ['sugerencia', 'sin_match'];

/**
 * Query de `GET /bandeja`. El ValidationPipe global no convierte de forma
 * implícita: cada propiedad declara su transformación. Un solo `estado`
 * llega como texto, por eso el Transform lo envuelve en arreglo.
 */
export class ConsultaBandejaDto {
  @ApiPropertyOptional({
    enum: ESTADOS_BANDEJA,
    isArray: true,
    description:
      'Repetible: ?estado=sugerencia&estado=sin_match. Por defecto sugerencia y sin_match.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as unknown[]) : [value],
  )
  @IsArray()
  @ArrayUnique()
  @IsIn(ESTADOS_BANDEJA, { each: true })
  estado?: EstadoBandeja[];
}

export class FilaBandejaDto {
  @ApiProperty() movimientoId: string;
  @ApiProperty({ example: '2026-09-02' }) fecha: string;
  @ApiProperty({ example: '1160.0000' }) monto: string;
  @ApiProperty() descripcion: string;
  @ApiProperty({ nullable: true, type: String }) referencia: string | null;
  @ApiProperty() moneda: string;
  @ApiProperty({ enum: ESTADOS_BANDEJA }) estado: EstadoBandeja;
}

export class RespuestaBandejaDto {
  @ApiProperty({ type: [FilaBandejaDto] }) datos: FilaBandejaDto[];
  @ApiProperty({ description: 'Filas que cumplen el filtro.' })
  total: number;
}
