import { ApiProperty } from '@nestjs/swagger';

/**
 * Historia 3.5: qué pasará con cada movimiento leído al aceptar. El frontend
 * espeja esta lista (`CLASES_VISTA_PREVIA`) y una prueba de deriva la vigila.
 */
export const CLASES_MOVIMIENTO_VISTA_PREVIA = [
  'nuevo',
  'existente',
  'dudoso',
] as const;
export type ClaseMovimientoVistaPrevia =
  (typeof CLASES_MOVIMIENTO_VISTA_PREVIA)[number];

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
  @ApiProperty({
    enum: CLASES_MOVIMIENTO_VISTA_PREVIA,
    description:
      'nuevo: entra abierto. existente: ya está, se omite. dudoso: misma huella con otra referencia, entra en revisión.',
  })
  clase!: ClaseMovimientoVistaPrevia;
}

/** Historia 3.5: cuántos de los movimientos leídos ya están en Cuadra. */
export class ResumenVistaPreviaDto {
  @ApiProperty({ description: 'No están en Cuadra: entrarán abiertos.' })
  nuevos!: number;
  @ApiProperty({
    description:
      'Ya están (misma huella y misma referencia) en cualquier estado: se omiten.',
  })
  existentes!: number;
  @ApiProperty({
    description:
      'Misma huella pero referencia distinta: entrarán en revisión, fuera de la conciliación.',
  })
  dudosos!: number;
}

/** Historia 3.4: lo que Cuadra leyó del PDF, antes de importarlo. */
export class VistaPreviaDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'estado-octubre.pdf' }) archivo!: string;
  @ApiProperty({ example: 'bbva', nullable: true, type: String })
  banco!: string | null;
  @ApiProperty({ description: 'Cuántos movimientos se leyeron.' })
  total!: number;
  @ApiProperty({
    example: '10000.0000',
    nullable: true,
    type: String,
    description: 'NULL en cargas guardadas antes de la historia 3.4.',
  })
  saldoInicial!: string | null;
  @ApiProperty({
    example: '11250.5000',
    nullable: true,
    type: String,
    description: 'NULL en cargas guardadas antes de la historia 3.4.',
  })
  saldoFinal!: string | null;
  @ApiProperty({
    type: ResumenVistaPreviaDto,
    description:
      'Informativo, calculado al leer; al aceptar se vuelve a calcular dentro del candado.',
  })
  resumen!: ResumenVistaPreviaDto;
  @ApiProperty({ type: [MovimientoVistaPreviaDto] })
  movimientos!: MovimientoVistaPreviaDto[];
}

/** Lo que responde aceptar la vista previa: la carga ya procesó. */
export class AceptacionDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'procesada' }) estado!: 'procesada';
  @ApiProperty({
    description:
      'Cuántos movimientos entraron a Cuadra (nuevos + dudosos); los existentes se omiten.',
  })
  movimientos!: number;
  @ApiProperty({ description: 'Entraron abiertos.' }) nuevos!: number;
  @ApiProperty({ description: 'Ya estaban: no se importaron.' })
  existentes!: number;
  @ApiProperty({ description: 'Entraron como pendiente_revision.' })
  dudosos!: number;
}

/** Lo que responde rechazar la vista previa: la carga quedó descartada. */
export class RechazoDto {
  @ApiProperty() cargaId!: string;
  @ApiProperty({ example: 'rechazada' }) estado!: 'rechazada';
}
