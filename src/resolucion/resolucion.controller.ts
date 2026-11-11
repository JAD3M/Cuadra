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
  ApiCookieAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import {
  LoteDto,
  LoteRespuestaDto,
  RechazarDto,
  ResolucionRespuestaDto,
} from './dto/resolucion.dto';
import { ResolucionService } from './resolucion.service';

/** La sesión (cookie, AD-6) ya la exige SesionCookieGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-15. Resolver una propuesta de conciliación. */
@ApiCookieAuth()
@Controller('conciliaciones')
export class ResolucionController {
  constructor(private readonly resolucion: ResolucionService) {}

  /**
   * 5.3. Confirma de una vez las propuestas que la persona dejó marcadas. Una
   * que no se puede confirmar se omite con su razón y no frena a las demás; el
   * lote no pide motivo. Mismo permiso que confirmar un caso (el auditor no).
   */
  @Post('lotes')
  @HttpCode(200)
  @Permiso('conciliaciones.resolver')
  @ApiOkResponse({ type: LoteRespuestaDto })
  @ApiBadRequestResponse({
    description:
      'ids y desmarcadas vacíos a la vez, repetidos, con más de 500 o con un id inválido; o una id en ids y en desmarcadas a la vez.',
  })
  @ApiForbiddenResponse({
    description:
      'Sin el permiso conciliaciones.resolver (por ejemplo, auditor).',
  })
  confirmarLote(
    @UsuarioActual() usuario: Sesion,
    @Body() cuerpo: LoteDto,
    @Req() solicitud: Request,
  ): Promise<LoteRespuestaDto> {
    return this.resolucion.confirmarLote(
      usuario.companyId,
      cuerpo.ids,
      {
        userId: usuario.userId,
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
        metodo: solicitud.method,
        ruta: solicitud.path,
      },
      cuerpo.desmarcadas ?? [],
    );
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  @Permiso('conciliaciones.resolver')
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
  @Permiso('conciliaciones.resolver')
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
