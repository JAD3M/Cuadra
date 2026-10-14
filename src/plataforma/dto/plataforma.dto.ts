import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizarEmail } from '../../users/email';

export class UsuarioPlataformaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'dueno@cuadra.mx' })
  correo!: string;
}

export class RespuestaLoginPlataformaDto {
  @ApiProperty({ type: UsuarioPlataformaDto })
  usuario!: UsuarioPlataformaDto;
}

export class EmpresaPlataformaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  razonSocial!: string;

  @ApiProperty()
  rfc!: string;
}

export class CrearEmpresaDto {
  @ApiProperty({ example: 'Ferretería del Bajío SA de CV', maxLength: 255 })
  // Corre antes de validar: los espacios de los bordes no cuentan.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'La razón social no puede ir vacía' })
  @MaxLength(255, { message: 'La razón social excede 255 caracteres' })
  razonSocial!: string;

  @ApiProperty({
    example: 'FDB190215QK4',
    description:
      'Se normaliza en el servidor (mayúsculas, sin espacios) antes de validar y comparar.',
  })
  @IsString()
  @MaxLength(64)
  rfc!: string;
}

export class InvitarAdminDto {
  @ApiProperty({
    example: 'primera.admin@cliente.mx',
    description:
      'Correo de la persona que será administradora. Se normaliza en el servidor. El rol es siempre `admin`.',
  })
  // Corre antes de validar: '  Ana@FDB.mx ' llega como 'ana@fdb.mx'.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

/** Idéntica exista o no la cuenta de ese correo (no revela cuentas). */
export class InvitacionEnviadaDto {
  @ApiProperty({ example: 'primera.admin@cliente.mx' })
  email!: string;
}
