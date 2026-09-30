import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import { BitacoraService } from './bitacora.service';
import { ConsultaBitacoraDto, RespuestaBitacoraDto } from './dto/bitacora.dto';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-16. Bitácora de la empresa: solo lectura, con filtros y paginación. */
@ApiBearerAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get()
  @Roles('admin', 'contador', 'revisor')
  @ApiOkResponse({ type: RespuestaBitacoraDto })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  listar(
    @UsuarioActual() usuario: Sesion,
    @Query() consulta: ConsultaBitacoraDto,
  ): Promise<RespuestaBitacoraDto> {
    return this.bitacora.listar(usuario.companyId, consulta);
  }
}
