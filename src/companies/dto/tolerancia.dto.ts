import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { dinero, esDecimal } from '../../common/dinero';

/** Tope de la tolerancia (MXN); el mismo que el CHECK de la columna. */
export const TOLERANCIA_MAXIMA = '100';

/**
 * Texto decimal sin signo, hasta 4 decimales (los de NUMERIC(18,4)) y entre
 * 0 y 100. Se valida aquí para que lo inválido sea 400, no un error del CHECK.
 * Nunca pasa por `number`.
 */
@ValidatorConstraint({ name: 'toleranciaValida', async: false })
export class ToleranciaValida implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== 'string' || !esDecimal(valor)) return false;
    if (!/^\d+(\.\d{1,4})?$/.test(valor)) return false;
    return dinero(valor).lte(TOLERANCIA_MAXIMA);
  }

  defaultMessage(): string {
    return 'toleranciaMonto debe ser un decimal en texto entre 0 y 100.00, con máximo 4 decimales';
  }
}

export class ActualizarToleranciaDto {
  @ApiProperty({
    example: '12.50',
    description: 'MXN absolutos, entre 0 y 100.00, máximo 4 decimales.',
  })
  @IsString()
  @Validate(ToleranciaValida)
  toleranciaMonto: string;
}

export class ToleranciaRespuestaDto {
  @ApiProperty({ example: '12.5000' })
  toleranciaMonto: string;
}
