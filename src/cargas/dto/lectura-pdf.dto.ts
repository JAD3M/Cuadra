import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { EstadoCarga } from '../../common/entities/tipos';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  /**
   * Contraseña de un PDF protegido (historia 8.2). Solo abre el archivo: vive
   * en memoria durante la petición y nunca se guarda ni se registra. No se
   * recorta: una contraseña puede llevar espacios. Vacía = no se mandó.
   */
  @ApiPropertyOptional({ maxLength: 128, writeOnly: true })
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsOptional()
  @IsString({ message: 'La contraseña del PDF debe ser texto' })
  @MaxLength(128, { message: 'La contraseña del PDF es demasiado larga' })
  @Matches(/^[^\0]*$/, {
    message: 'La contraseña del PDF trae caracteres no válidos',
  })
  contrasena?: string;
}

/** Lo que responde la lectura de un PDF que cuadra: ya quedó guardado. */
export class RespuestaLecturaPdfDto {
  @ApiProperty({ example: 'bbva' }) banco!: string;
  /** `null` si el PDF no trae saldos: sin cuadre automático (historia 8.3). */
  @ApiProperty({ example: '10000.00', nullable: true })
  saldoInicial!: string | null;
  @ApiProperty({ example: '11250.50', nullable: true })
  saldoFinal!: string | null;
  /** `false`: el PDF no trae saldos y solo una persona lo revisa en la vista previa. */
  @ApiProperty({ example: true }) cuadreAutomatico!: boolean;
  @ApiProperty({ example: 2 }) movimientosLeidos!: number;
  /** Siempre 0 aquí: con una línea no leída el PDF se rechaza (400). */
  @ApiProperty({ example: 0 }) lineasNoLeidas!: number;
  @ApiProperty({ format: 'uuid' }) cargaId!: string;
  /** 'pendiente_vista_previa' al guardarlo; el actual si ya existía. */
  @ApiProperty({ example: 'pendiente_vista_previa' }) estado!: EstadoCarga;
  @ApiProperty({ example: false }) yaExistia!: boolean;
}
