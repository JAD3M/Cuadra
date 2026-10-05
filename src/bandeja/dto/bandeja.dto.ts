import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const ESTADOS_BANDEJA = [
  'conciliado',
  'sugerencia',
  'sin_match',
] as const;
export type EstadoBandeja = (typeof ESTADOS_BANDEJA)[number];

/** Sin `estado`, la bandeja muestra lo que espera revisión. */
export const ESTADOS_POR_DEFECTO: EstadoBandeja[] = ['sugerencia', 'sin_match'];
export const LIMITE_POR_DEFECTO = 50;
export const LIMITE_MAXIMO = 200;

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

export class CfdiResumenDto {
  @ApiProperty() id: string;
  @ApiProperty() uuidFiscal: string;
  @ApiProperty({ nullable: true, type: String }) serie: string | null;
  @ApiProperty({ nullable: true, type: String }) folio: string | null;
  @ApiProperty({ nullable: true, type: String }) nombreEmisor: string | null;
  @ApiProperty() rfcReceptor: string;
  @ApiProperty({ nullable: true, type: String }) nombreReceptor: string | null;
  @ApiProperty({ example: '2026-09-01' }) fechaEmision: string;
  @ApiProperty({ example: '1160.0000' }) total: string;
  @ApiProperty() moneda: string;
  @ApiProperty({ nullable: true, type: String }) metodoPago: string | null;
}

export class MejorPropuestaDto {
  @ApiProperty() conciliacionId: string;
  @ApiProperty({ nullable: true, type: String, example: '0.9500' })
  score: string | null;
  @ApiProperty({ nullable: true, type: String }) regla: string | null;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
  @ApiProperty({ nullable: true, type: String, example: '0.0000' })
  diferenciaMonto: string | null;
  @ApiProperty({ type: CfdiResumenDto }) cfdi: CfdiResumenDto;
}

export class FilaBandejaDto {
  @ApiProperty() movimientoId: string;
  @ApiProperty({ example: '2026-09-02' }) fecha: string;
  @ApiProperty({ example: '1160.0000' }) monto: string;
  @ApiProperty() descripcion: string;
  @ApiProperty({ nullable: true, type: String }) referencia: string | null;
  @ApiProperty() moneda: string;
  @ApiProperty({ enum: ESTADOS_BANDEJA }) estado: EstadoBandeja;
  @ApiProperty({ description: 'Propuestas vigentes del movimiento.' })
  propuestasCount: number;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
  @ApiProperty({ nullable: true, type: String }) regla: string | null;
  @ApiProperty({ nullable: true, type: MejorPropuestaDto })
  mejorPropuesta: MejorPropuestaDto | null;
}

export class RespuestaBandejaDto {
  @ApiProperty({ type: [FilaBandejaDto] }) datos: FilaBandejaDto[];
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
  @ApiProperty({ description: 'Filas que cumplen el filtro, sin paginar.' })
  total: number;
}

export class ConteosBandejaDto {
  @ApiProperty({ description: 'Movimientos conciliados a mano o confirmados.' })
  conciliado: number;
  @ApiProperty({ description: 'Movimientos abiertos con propuesta vigente.' })
  sugerencia: number;
  @ApiProperty({ description: 'Movimientos abiertos con motivo sin match.' })
  sin_match: number;
}

export class MontoPorMonedaDto {
  @ApiProperty({ example: 'MXN', description: 'Código de moneda de 3 letras.' })
  moneda: string;
  @ApiProperty({
    example: '138990.4000',
    description: 'Suma exacta, como texto decimal, nunca flotante.',
  })
  monto: string;
}

export class ResumenBandejaDto {
  @ApiProperty({
    type: ConteosBandejaDto,
    description:
      'Conteos por estado; coinciden con el total de GET /bandeja?estado=.',
  })
  conteos: ConteosBandejaDto;
  @ApiProperty({
    type: [MontoPorMonedaDto],
    description:
      'Monto por revisar (sugerencia + sin_match) por moneda, ordenado por moneda. Sin monedas sin pendientes.',
  })
  montoPorRevisar: MontoPorMonedaDto[];
}
