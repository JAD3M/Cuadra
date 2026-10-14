import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_PASSWORD } from '../../common/politica-contrasena';
import { normalizarEmail } from '../../users/email';

export const MOTIVOS_ENLACE_INVALIDO = [
  'usada',
  'caducada',
  'reemplazada',
  'desconocida',
] as const;
export type MotivoEnlaceInvalido = (typeof MOTIVOS_ENLACE_INVALIDO)[number];

export class SolicitarRecuperacionDto {
  @ApiProperty({ example: 'ana.reyes@fdb.mx' })
  // Corre antes de validar: '  Ana@FDB.mx ' llega como 'ana@fdb.mx'.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class SolicitudRecibidaDto {
  @ApiProperty({
    description:
      'Siempre el mismo texto, exista o no la cuenta: no revela quién tiene una.',
  })
  mensaje!: string;
}

export class EstadoRecuperacionDto {
  @ApiProperty({ enum: ['vigente', 'invalida'] })
  estado!: 'vigente' | 'invalida';

  @ApiProperty({
    enum: MOTIVOS_ENLACE_INVALIDO,
    nullable: true,
    description: 'Nulo cuando el enlace está vigente.',
  })
  motivo!: MotivoEnlaceInvalido | null;
}

export class RestablecerContrasenaDto {
  @ApiProperty({ description: 'Contraseña nueva (mínimo 12 caracteres).' })
  @IsString()
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  password!: string;
}

export class ContrasenaRestablecidaDto {
  @ApiProperty()
  mensaje!: string;
}
