import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import { BitacoraService } from './bitacora.service';
import {
  ConsultaBitacoraDto,
  RespuestaBitacoraDto,
  RespuestaUsuariosBitacoraDto,
} from './dto/bitacora.dto';

/** La sesión (cookie, AD-6) ya la exige SesionCookieGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/**
 * CU-16. Bitácora de la empresa: solo lectura, con filtros y paginación.
 * CU-26 suma la lista de personas para el filtro de usuario.
 */
@ApiCookieAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  /** Va antes que cualquier ruta con parámetro: `usuarios` no es un id. */
  @Get('usuarios')
  @Roles('admin', 'contador', 'revisor')
  @ApiOkResponse({ type: RespuestaUsuariosBitacoraDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  usuarios(
    @UsuarioActual() usuario: Sesion,
  ): Promise<RespuestaUsuariosBitacoraDto> {
    return this.bitacora.usuarios(usuario.companyId);
  }

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
