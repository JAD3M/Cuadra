import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { UsuarioActual } from '../common/decorators/decoradores';
import { BandejaService } from './bandeja.service';
import {
  ConsultaBandejaDto,
  RespuestaBandejaDto,
  ResumenBandejaDto,
} from './dto/bandeja.dto';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-14. Bandeja de revisión: cualquier miembro de la empresa, solo lectura. */
@ApiBearerAuth()
@Controller('bandeja')
export class BandejaController {
  constructor(private readonly bandeja: BandejaService) {}

  @Get()
  @ApiOkResponse({ type: RespuestaBandejaDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  listar(
    @UsuarioActual() usuario: Sesion,
    @Query() consulta: ConsultaBandejaDto,
  ): Promise<RespuestaBandejaDto> {
    return this.bandeja.listar(usuario.companyId, consulta);
  }

  /** CU-22. Conteos por estado y monto por revisar; mismos roles que el listado. */
  @Get('resumen')
  @ApiOkResponse({ type: ResumenBandejaDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  @ApiForbiddenResponse({ description: 'Sin membresía vigente en la empresa.' })
  resumen(@UsuarioActual() usuario: Sesion): Promise<ResumenBandejaDto> {
    return this.bandeja.resumen(usuario.companyId);
  }
}
