import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PerfilesBancarios } from './perfiles-bancarios';

@ApiBearerAuth()
@Controller('bancos')
export class BancosController {
  constructor(private readonly perfiles: PerfilesBancarios) {}

  /** CU-10. Cualquier rol con sesión: es lo que llena el selector del front. */
  @Get('perfiles')
  listarPerfiles(): Array<{ id: string; nombre: string }> {
    return this.perfiles.listar();
  }
}
