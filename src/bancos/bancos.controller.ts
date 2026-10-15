import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Permiso } from '../common/decorators/decoradores';
import { PerfilesBancarios } from './perfiles-bancarios';

@ApiCookieAuth()
@Controller('bancos')
export class BancosController {
  constructor(private readonly perfiles: PerfilesBancarios) {}

  /** CU-10. Llena el selector de la carga: lo ve quien puede cargar. */
  @Get('perfiles')
  @Permiso('cargas.cargar')
  listarPerfiles(): Array<{ id: string; nombre: string }> {
    return this.perfiles.listar();
  }
}
