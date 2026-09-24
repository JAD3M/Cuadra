// LoginDto para user.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { normalizarEmail } from '../../users/email';
export class LoginDto {
  @ApiProperty({ example: 'jorge.tapia@despacho.mx' })
  // Corre antes de validar: '  Ana@FDB.mx ' llega como 'ana@fdb.mx'.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'tu-contraseña' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}
