import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { Permiso } from '../common/decorators/decoradores';
import { BANCOS_PDF_CON_NOMBRE } from './pdf/lectores-pdf';
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

  /**
   * Historia 8.3 (UX-DR4). Los bancos con lector de PDF, para el selector de
   * la carga: sale del registro de lectores, no de una copia en la pantalla.
   */
  @Get('pdf')
  @Permiso('cargas.cargar')
  listarBancosPdf(): Array<{ id: string; nombre: string }> {
    return BANCOS_PDF_CON_NOMBRE.map(({ id, nombre }) => ({ id, nombre }));
  }
}
