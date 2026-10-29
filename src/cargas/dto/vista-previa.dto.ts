import { ApiProperty } from '@nestjs/swagger';

/** Un movimiento leído del PDF, tal como entraría a `movimientos`. */
export class MovimientoVistaPreviaDto {
  @ApiProperty({ example: '2026-10-15' }) fecha!: string;
  @ApiProperty({
    example: '-250.0000',
    description: 'Con signo: positivo es abono, negativo es cargo. NUMERIC.',
  })
  monto!: string;
  @ApiProperty({ example: 'SINT-0001', nullable: true, type: String })
  referencia!: string | null;
}

/** Historia 3.4: lo que Cuadra leyó del PDF, antes de importarlo. */
export class VistaPreviaDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'estado-octubre.pdf' }) archivo!: string;
  @ApiProperty({ example: 'bbva', nullable: true, type: String })
  banco!: string | null;
  @ApiProperty({ description: 'Cuántos movimientos se leyeron.' })
  total!: number;
  @ApiProperty({ example: '10000.0000' }) saldoInicial!: string;
  @ApiProperty({ example: '11250.5000' }) saldoFinal!: string;
  @ApiProperty({ type: [MovimientoVistaPreviaDto] })
  movimientos!: MovimientoVistaPreviaDto[];
}

/** Lo que responde aceptar la vista previa: la carga ya procesó. */
export class AceptacionDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'procesada' }) estado!: 'procesada';
  @ApiProperty({ description: 'Cuántos movimientos entraron a conciliación.' })
  movimientos!: number;
}

/** Lo que responde rechazar la vista previa: la carga quedó descartada. */
export class RechazoDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'rechazada' }) estado!: 'rechazada';
}
