import { ApiProperty } from '@nestjs/swagger';
import type { EmpresaDisponible } from '../tipos';

export class EmpresaDisponibleDto implements EmpresaDisponible {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ferreteria del Bajio SA de CV' })
  razonSocial!: string;
}

export class RespuestaLoginDto {
  @ApiProperty({
    description:
      "Token de selección (scope 'seleccion', 5 min). Solo sirve para canjearlo en POST /auth/empresa/:id.",
  })
  token!: string;

  @ApiProperty({ type: [EmpresaDisponibleDto] })
  empresas!: EmpresaDisponibleDto[];
}

export class RespuestaTokenDto {
  @ApiProperty({
    description:
      "Token de sesión (scope 'sesion', 15 min) ligado a la empresa elegida.",
  })
  token!: string;
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
