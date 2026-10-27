import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

/** Campo de texto del multipart de la lectura de PDF (historia 3.2). */
export class LecturaPdfDto {
  /** Id del banco; los soportados salen del registro de lectores. */
  @ApiProperty({ example: 'bbva', maxLength: 32 })
  @IsString({ message: 'Falta el banco del estado de cuenta' })
  @MaxLength(32)
  @Matches(/^[^\0]*$/, { message: 'banco no puede traer bytes nulos' })
  banco!: string;
}

/** Lo que responde la lectura: nada se guardó. */
export class RespuestaLecturaPdfDto {
  @ApiProperty({ example: 'bbva' }) banco!: string;
  @ApiProperty({ example: '10000.00' }) saldoInicial!: string;
  @ApiProperty({ example: '11250.50' }) saldoFinal!: string;
  @ApiProperty({ example: 2 }) movimientosLeidos!: number;
  @ApiProperty({ example: 0 }) lineasNoLeidas!: number;
}
