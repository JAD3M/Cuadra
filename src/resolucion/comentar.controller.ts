import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import { ComentarService } from './comentar.service';
import { ComentarDto, ComentarioDto } from './dto/comentar.dto';

type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** Historia 5.9 (FR-68). Dejar un comentario sobre una decisión. */
@ApiCookieAuth()
@Controller('conciliaciones')
export class ComentarController {
  constructor(private readonly comentar: ComentarService) {}

  @Post(':id/comentarios')
  @Permiso('conciliaciones.comentar')
  @ApiCreatedResponse({ type: ComentarioDto })
  @ApiBadRequestResponse({ description: 'Id inválido o texto vacío o largo.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiForbiddenResponse({ description: 'Rol sin el permiso (auditor).' })
  dejarComentario(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: ComentarDto,
    @Req() solicitud: Request,
  ): Promise<ComentarioDto> {
    return this.comentar.comentar(usuario.companyId, id, cuerpo.texto, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
      metodo: solicitud.method,
      ruta: solicitud.path,
    });
  }
}
