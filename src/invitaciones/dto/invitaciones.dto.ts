import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_PASSWORD } from '../../common/politica-contrasena';

export const MOTIVOS_INVITACION_INVALIDA = [
  'usada',
  'caducada',
  'reemplazada',
  'desconocida',
] as const;
export type MotivoInvitacionInvalida =
  (typeof MOTIVOS_INVITACION_INVALIDA)[number];

/**
 * Estado del enlace. Misma forma en todos los casos: del lado inválido no
 * hay datos de la empresa ni de la cuenta.
 */
export class EstadoInvitacionDto {
  @ApiProperty({ enum: ['vigente', 'invalida'] })
  estado!: 'vigente' | 'invalida';

  @ApiProperty({
    enum: MOTIVOS_INVITACION_INVALIDA,
    nullable: true,
    description: 'Nulo cuando el enlace está vigente.',
  })
  motivo!: MotivoInvitacionInvalida | null;

  @ApiProperty({ nullable: true, description: 'Nombre de la empresa.' })
  empresa!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Verdadero cuando la persona aún no tiene cuenta y debe elegir contraseña.',
  })
  requierePassword!: boolean | null;
}

export class AceptarInvitacionDto {
  @ApiProperty({
    required: false,
    description:
      'Solo para cuenta nueva (mínimo 12 caracteres). Con una cuenta existente se ignora: nunca se cambia su contraseña.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  password?: string;

  @ApiProperty({
    required: false,
    maxLength: 255,
    description: 'Solo para cuenta nueva. Con una cuenta existente se ignora.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  nombre?: string;
}

export class InvitacionAceptadaDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty()
  razonSocial!: string;

  @ApiProperty({
    description: 'Verdadero si la cuenta se creó con este enlace.',
  })
  cuentaNueva!: boolean;
}
