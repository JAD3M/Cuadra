import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos de texto del multipart de CU-09. Se copian a cada movimiento. */
export class EstadoCuentaDto {
  @ApiPropertyOptional({ example: 'BBVA', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128) // movimientos.banco
  banco?: string;

  /** Enmascarada: solo los últimos dígitos, nunca la CLABE completa. */
  @ApiPropertyOptional({ example: '****1234', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32) // movimientos.cuenta
  cuenta?: string;
}
