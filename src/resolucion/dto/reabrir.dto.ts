import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  RAZONES_OMISION_REAPERTURA,
  type RazonOmisionReapertura,
} from '../../common/entities/tipos';
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

export class OmisionDeReaperturaDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: RAZONES_OMISION_REAPERTURA })
  razon: RazonOmisionReapertura;
}

/** Historia 5.8: lo que dejó reabrir un lote completo. */
export class ReabrirLoteRespuestaDto {
  @ApiProperty() loteId: string;
  @ApiProperty({
    type: [String],
    description: 'Ids de las decisiones reabiertas (id ascendente).',
  })
  reabiertas: string[];
  @ApiProperty({
    type: [OmisionDeReaperturaDto],
    description: 'Las que quedaron fuera, cada una con su razón.',
  })
  omitidas: OmisionDeReaperturaDto[];
}
