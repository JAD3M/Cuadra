import { ApiProperty } from '@nestjs/swagger';

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
