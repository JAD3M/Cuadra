import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { EstadoCarga } from '../../common/entities/tipos';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** Campo de texto del multipart de la lectura de PDF (historia 3.2). */
export class LecturaPdfDto {
  /** Id del banco; los soportados salen del registro de lectores. */
  @ApiProperty({ example: 'bbva', maxLength: 32 })
  // Corre antes de validar: '   ' llega como '' y se rechaza como ausente.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Falta el banco del estado de cuenta' })
  @IsNotEmpty({ message: 'Falta el banco del estado de cuenta' })
  @MaxLength(32)
  @Matches(/^[^\0]*$/, { message: 'banco no puede traer bytes nulos' })
  banco!: string;
}

/** Lo que responde la lectura de un PDF que cuadra: ya quedó guardado. */
export class RespuestaLecturaPdfDto {
  @ApiProperty({ example: 'bbva' }) banco!: string;
  @ApiProperty({ example: '10000.00' }) saldoInicial!: string;
  @ApiProperty({ example: '11250.50' }) saldoFinal!: string;
  @ApiProperty({ example: 2 }) movimientosLeidos!: number;
  /** Siempre 0 aquí: con una línea no leída el PDF se rechaza (400). */
  @ApiProperty({ example: 0 }) lineasNoLeidas!: number;
  @ApiProperty({ format: 'uuid' }) cargaId!: string;
  /** 'pendiente_vista_previa' al guardarlo; el actual si ya existía. */
  @ApiProperty({ example: 'pendiente_vista_previa' }) estado!: EstadoCarga;
  @ApiProperty({ example: false }) yaExistia!: boolean;
}
