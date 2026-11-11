import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
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

  @ApiProperty({
    description:
      'false = la empresa opera sin separación de funciones (la apagó el dueño).',
  })
  separacionFunciones!: boolean;
}

export class CambiarSeparacionDto {
  @ApiProperty({
    description: 'true la activa; false la desactiva solo para esa empresa.',
  })
  @IsBoolean({ message: 'Indica si la separación queda activa (true o false)' })
  activa!: boolean;

  @ApiProperty({
    example: 'Despacho de una sola persona',
    maxLength: 500,
    description: 'Obligatorio, también al volver a activarla.',
  })
  // Corre antes de validar: los espacios de los bordes no cuentan.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El motivo es obligatorio' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(500, { message: 'El motivo excede 500 caracteres' })
  motivo!: string;
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

export class BancoPlataformaDto {
  @ApiProperty({ example: 'bbva' })
  banco!: string;

  @ApiProperty({
    description:
      'Cargas aceptadas de este banco entre todas las empresas, calculadas por consulta (no es un contador guardado).',
  })
  aceptadas!: number;

  @ApiProperty({
    example: 5,
    description:
      'Cargas aceptadas que el banco necesita para poder levantar su vista previa. Lo fija el servidor.',
  })
  minimoAceptadas!: number;

  @ApiProperty({ description: 'La vista previa obligatoria ya se levantó.' })
  levantada!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  levantadaEn!: string | null;
}

export class ConteoFacturasDto {
  @ApiProperty({ description: 'Todas las facturas de la empresa.' })
  total!: number;

  @ApiProperty({ description: 'Las facturas con método de pago PPD.' })
  ppd!: number;
}

export class ConteoMovimientosDto {
  @ApiProperty({ description: 'Todos los movimientos de la empresa.' })
  total!: number;

  @ApiProperty({ description: 'Movimientos de clase `parcialidad`.' })
  parcialidades!: number;

  @ApiProperty({ description: 'Movimientos de clase `comision`.' })
  comisiones!: number;
}

export class FraccionesEmpresaDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() razonSocial!: string;
  @ApiProperty({ type: ConteoFacturasDto }) facturas!: ConteoFacturasDto;
  @ApiProperty({ type: ConteoMovimientosDto })
  movimientos!: ConteoMovimientosDto;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.2500',
    description:
      'Facturas PPD entre el total de facturas, con cuatro decimales; null si la empresa no tiene facturas.',
  })
  fraccionPpd!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.0100',
    description:
      'Movimientos de clase `parcialidad` entre el total de movimientos; null si no hay movimientos.',
  })
  fraccionParcialidades!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.0300',
    description:
      'Movimientos de clase `comision` entre el total de movimientos; null si no hay movimientos.',
  })
  fraccionComisiones!: string | null;
}
