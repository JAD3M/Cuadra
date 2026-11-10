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
import { DescartarDto, DescarteRespuestaDto } from './dto/descarte.dto';
import { DescarteService } from './descarte.service';

type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** Historia 5.6 (FR-21). Descartar un movimiento y deshacer el descarte. */
@ApiCookieAuth()
@Controller('movimientos')
export class DescarteController {
  constructor(private readonly descartes: DescarteService) {}

  @Post(':id/descartar')
  @HttpCode(200)
  @Permiso('movimientos.descartar')
  @ApiOkResponse({ type: DescarteRespuestaDto })
  @ApiBadRequestResponse({ description: 'Id inválido o motivo vacío.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiConflictResponse({
    description:
      'El movimiento ya no está abierto o ya tiene decisión vigente.',
  })
  @ApiForbiddenResponse({
    description: 'Sin el permiso movimientos.descartar (por ejemplo, auditor).',
  })
  descartar(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: DescartarDto,
    @Req() solicitud: Request,
  ): Promise<DescarteRespuestaDto> {
    return this.descartes.descartar(usuario.companyId, id, cuerpo.motivo, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
      metodo: solicitud.method,
      ruta: solicitud.path,
    });
  }

  @Post(':id/deshacer-descarte')
  @HttpCode(200)
  @Permiso('movimientos.deshacer_descarte')
  @ApiOkResponse({ type: DescarteRespuestaDto })
  @ApiBadRequestResponse({ description: 'Id inválido.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiConflictResponse({ description: 'El movimiento no está descartado.' })
  @ApiForbiddenResponse({
    description:
      'Ni quien descartó ni administrador, o rol sin el permiso (auditor).',
  })
  deshacer(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() solicitud: Request,
  ): Promise<DescarteRespuestaDto> {
    return this.descartes.deshacer(usuario.companyId, id, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
      metodo: solicitud.method,
      ruta: solicitud.path,
    });
  }
}
