import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import { ReabrirDto, ReabrirRespuestaDto } from './dto/reabrir.dto';
import { ReabrirService } from './reabrir.service';

type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** Historia 5.7 (FR-26 a FR-30). Reabrir una confirmación. */
@ApiCookieAuth()
@Controller('conciliaciones')
export class ReabrirController {
  constructor(private readonly reabrir: ReabrirService) {}

  @Post(':id/reabrir')
  @HttpCode(200)
  @Permiso('conciliaciones.reabrir')
  @ApiOkResponse({ type: ReabrirRespuestaDto })
  @ApiBadRequestResponse({ description: 'Id inválido o motivo vacío.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiConflictResponse({ description: 'La conciliación no está confirmada.' })
  @ApiForbiddenResponse({
    description:
      'Ni quien confirmó ni administrador, o rol sin el permiso (auditor).',
  })
  reabrirConfirmacion(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: ReabrirDto,
    @Req() solicitud: Request,
  ): Promise<ReabrirRespuestaDto> {
    return this.reabrir.reabrir(usuario.companyId, id, cuerpo.motivo, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
      metodo: solicitud.method,
      ruta: solicitud.path,
    });
  }
}
