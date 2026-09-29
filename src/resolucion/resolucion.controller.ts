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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import { RechazarDto, ResolucionRespuestaDto } from './dto/resolucion.dto';
import { ResolucionService } from './resolucion.service';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-15. Resolver una propuesta de conciliación. */
@ApiBearerAuth()
@Controller('conciliaciones')
export class ResolucionController {
  constructor(private readonly resolucion: ResolucionService) {}

  @Post(':id/confirmar')
  @HttpCode(200)
  @Roles('admin', 'contador', 'revisor')
  @ApiOkResponse({ type: ResolucionRespuestaDto })
  @ApiBadRequestResponse({ description: 'Id inválido.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiConflictResponse({
    description:
      'Ya no es propuesta, o el CFDI o el movimiento ya no están abiertos.',
  })
  @ApiForbiddenResponse({
    description:
      'Quien subió el CFDI o el estado de cuenta no puede confirmar (D-08).',
  })
  confirmar(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() solicitud: Request,
  ): Promise<ResolucionRespuestaDto> {
    return this.resolucion.confirmar(usuario.companyId, id, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
      metodo: solicitud.method,
      ruta: solicitud.path,
    });
  }

  @Post(':id/rechazar')
  @HttpCode(200)
  @Roles('admin', 'contador', 'revisor')
  @ApiOkResponse({ type: ResolucionRespuestaDto })
  @ApiBadRequestResponse({ description: 'Id o motivo inválidos.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  @ApiConflictResponse({ description: 'La conciliación ya no es propuesta.' })
  rechazar(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cuerpo: RechazarDto,
    @Req() solicitud: Request,
  ): Promise<ResolucionRespuestaDto> {
    return this.resolucion.rechazar(usuario.companyId, id, cuerpo.motivo, {
      userId: usuario.userId,
      ip: solicitud.ip,
      userAgent: solicitud.headers['user-agent'],
    });
  }
}
