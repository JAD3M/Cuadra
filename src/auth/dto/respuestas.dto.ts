import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Rol } from '../../common/entities/tipos';
import type {
  ContextoSesion,
  EmpresaContexto,
  EmpresaDisponible,
  UsuarioPublico,
} from '../tipos';

export class UsuarioPublicoDto implements UsuarioPublico {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jorge Tapia' })
  nombre!: string;

  @ApiProperty({
    example: 'jorge.tapia@despacho.mx',
    description: 'Normalizado, tal como está guardado.',
  })
  email!: string;
}

export class EmpresaDisponibleDto implements EmpresaDisponible {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ferreteria del Bajio SA de CV' })
  razonSocial!: string;

  @ApiProperty({ example: 'FDB190215QK4' })
  rfc!: string;

  @ApiProperty({
    enum: ROLES,
    enumName: 'Rol',
    isArray: true,
    description:
      'Roles del usuario en la empresa. Orden fijo: admin, contador, revisor.',
  })
  roles!: Rol[];
}

export class EmpresaContextoDto implements EmpresaContexto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ferreteria del Bajio SA de CV' })
  razonSocial!: string;

  @ApiProperty({ example: 'FDB190215QK4' })
  rfc!: string;
}

export class ContextoSesionDto implements ContextoSesion {
  @ApiProperty({ type: UsuarioPublicoDto })
  usuario!: UsuarioPublicoDto;

  @ApiProperty({ type: EmpresaContextoDto })
  empresa!: EmpresaContextoDto;

  @ApiProperty({
    enum: ROLES,
    enumName: 'Rol',
    isArray: true,
    description:
      'Roles vigentes en la empresa. Orden fijo: admin, contador, revisor.',
  })
  roles!: Rol[];
}

/**
 * El token de sesión viaja solo en la cookie `cuadra_sesion` (httpOnly):
 * nunca en el cuerpo.
 */
export class RespuestaLoginDto {
  @ApiProperty({ type: UsuarioPublicoDto })
  usuario!: UsuarioPublicoDto;

  @ApiProperty({ type: [EmpresaDisponibleDto] })
  empresas!: EmpresaDisponibleDto[];
}

/** Forma de los errores que responde Nest, para documentarlos en Swagger. */
export class RespuestaErrorDto {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Unauthorized' })
  error!: string;

  @ApiProperty({ example: 'No autorizado' })
  message!: string;
}
