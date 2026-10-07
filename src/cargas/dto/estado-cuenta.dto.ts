import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Postgres rechaza el byte 0 en varchar: sin esto, el INSERT de la carga
 * daría 500 por algo que mandó el usuario.
 */
const SIN_NULOS = /^[^\0]*$/;

/**
 * Campos de texto del multipart de CU-09. Se guardan en la carga y se copian
 * a cada movimiento, así que se validan contra sus columnas aquí, en el
 * POST: lo que no cabe es 400, no un error de base.
 *
 * `MaxLength` cuenta unidades UTF-16 y Postgres cuenta caracteres, que
 * nunca son más: lo que pasa aquí siempre cabe.
 */
export class EstadoCuentaDto {
  @ApiPropertyOptional({ example: 'BBVA', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128) // cargas.banco y movimientos.banco
  @Matches(SIN_NULOS, { message: 'banco no puede traer bytes nulos' })
  banco?: string;

  /**
   * Se guarda tal como llega: el cliente pide solo los últimos dígitos, pero
   * el servidor no la enmascara ni la valida.
   */
  @ApiPropertyOptional({ example: '****1234', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32) // cargas.cuenta y movimientos.cuenta
  @Matches(SIN_NULOS, { message: 'cuenta no puede traer bytes nulos' })
  cuenta?: string;

  /** CU-10: id del perfil de banco. Sin él, el formato canónico ('cuadra'). */
  @ApiPropertyOptional({ example: 'banco-norte', default: 'cuadra' })
  @IsOptional()
  @IsString()
  @MaxLength(64) // cargas.perfil
  perfil?: string;
}
