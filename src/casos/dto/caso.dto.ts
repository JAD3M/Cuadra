import { ApiProperty } from '@nestjs/swagger';
import {
  ESTADOS_MOVIMIENTO,
  type EstadoMovimiento,
  ORIGENES_CONCILIACION,
  type OrigenConciliacion,
} from '../../common/entities/tipos';
import {
  CfdiResumenDto,
  ESTADOS_BANDEJA,
  type EstadoBandeja,
} from '../../bandeja/dto/bandeja.dto';

export class CasoMovimientoDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: '2026-09-02', description: 'Día, sin zona horaria.' })
  fecha: string;
  @ApiProperty({
    example: '1160.0000',
    description: 'Texto decimal exacto, nunca flotante.',
  })
  monto: string;
  @ApiProperty() moneda: string;
  @ApiProperty() descripcion: string;
  @ApiProperty({ nullable: true, type: String }) referencia: string | null;
  @ApiProperty({
    enum: ESTADOS_MOVIMIENTO,
    description: 'Estado guardado del movimiento, sin derivar.',
  })
  estado: EstadoMovimiento;
}

export class SinMatchCasoDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Regla que dejó el movimiento sin match.',
  })
  regla: string | null;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
}

export class ConfirmadaPorDto {
  @ApiProperty() nombre: string;
}

export class PropuestaCasoDto {
  @ApiProperty() conciliacionId: string;
  @ApiProperty({
    enum: ['propuesta', 'confirmada'],
    description: 'Las rechazadas nunca se devuelven.',
  })
  estado: 'propuesta' | 'confirmada';
  @ApiProperty({ enum: ORIGENES_CONCILIACION })
  origen: OrigenConciliacion;
  @ApiProperty({ nullable: true, type: String, example: '0.9500' })
  score: string | null;
  @ApiProperty({ nullable: true, type: String }) regla: string | null;
  @ApiProperty({ nullable: true, type: String }) motivo: string | null;
  @ApiProperty({ nullable: true, type: String, example: '-0.0040' })
  diferenciaMonto: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-03T15:04:05.000Z',
  })
  confirmadaAt: string | null;
  @ApiProperty({ nullable: true, type: ConfirmadaPorDto })
  confirmadaPor: ConfirmadaPorDto | null;
  @ApiProperty({ type: CfdiResumenDto }) cfdi: CfdiResumenDto;
}

export class RespuestaCasoDto {
  @ApiProperty({ type: CasoMovimientoDto }) movimiento: CasoMovimientoDto;
  @ApiProperty({
    enum: ESTADOS_BANDEJA,
    description: 'Mismo estado derivado que GET /bandeja.',
  })
  estado: EstadoBandeja;
  @ApiProperty({
    nullable: true,
    type: SinMatchCasoDto,
    description: 'Solo en sin_match; sus campos son nulos si no hay registro.',
  })
  sinMatch: SinMatchCasoDto | null;
  @ApiProperty({
    example: '0.5000',
    description: 'Tolerancia de monto de la empresa, texto decimal.',
  })
  toleranciaMonto: string;
  @ApiProperty({
    type: [PropuestaCasoDto],
    description:
      'Propuestas vigentes (score descendente, nulos al final, luego id) o solo la confirmada.',
  })
  propuestas: PropuestaCasoDto[];
}
