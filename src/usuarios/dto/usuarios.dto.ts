import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ROLES, type Rol } from '../../common/entities/tipos';
import { normalizarEmail } from '../../users/email';

export class InvitarUsuarioDto {
  @ApiProperty({
    example: 'luis.mendoza@fdb.mx',
    description: 'Correo de la persona. Se normaliza en el servidor.',
  })
  // Corre antes de validar: '  Luis@FDB.mx ' llega como 'luis@fdb.mx'.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    enum: ROLES,
    isArray: true,
    minItems: 1,
    example: ['contador', 'revisor'],
    description:
      'Uno o más roles de la empresa. Los repetidos se descartan, conservando el orden.',
  })
  // Corre antes de validar: ['a', 'a', 'b'] llega como ['a', 'b'].
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? [...new Set(value as unknown[])] : value,
  )
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un rol' })
  @ArrayMaxSize(ROLES.length)
  @IsIn(ROLES, { each: true, message: 'Cada rol debe ser uno de ROLES' })
  roles!: Rol[];
}

/** Idéntica exista o no la cuenta de ese correo (no revela cuentas). */
export class InvitacionUsuarioEnviadaDto {
  @ApiProperty({ example: 'luis.mendoza@fdb.mx' })
  email!: string;

  @ApiProperty({ enum: ROLES, isArray: true })
  roles!: Rol[];
}

/** Historia 2.4. Una invitación que nadie ha aceptado; nunca trae el token. */
export class InvitacionPendienteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'luis.mendoza@fdb.mx' })
  email!: string;

  @ApiProperty({ enum: ROLES, isArray: true })
  roles!: Rol[];

  @ApiProperty({ format: 'date-time' })
  creadaEn!: string;

  @ApiProperty({ format: 'date-time' })
  venceEn!: string;

  @ApiProperty({
    description:
      'Verdadero si el enlace ya venció. Sigue pendiente: se puede reenviar o cancelar.',
  })
  vencida!: boolean;

  @ApiProperty({
    nullable: true,
    description:
      'Nombre de quien invitó; nulo si la creó la plataforma al dar de alta la empresa.',
  })
  invitadaPor!: string | null;
}

export class InvitacionCanceladaDto {
  @ApiProperty({ example: 'luis.mendoza@fdb.mx' })
  email!: string;
}
