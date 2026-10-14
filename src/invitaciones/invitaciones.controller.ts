import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { leerCookie } from '../auth/guards/sesion-cookie.guard';
import { fijarCookieSesion, SesionesService } from '../auth/sesiones.service';
import { Publico } from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import {
  AceptarInvitacionDto,
  EstadoInvitacionDto,
  InvitacionAceptadaDto,
} from './dto/invitaciones.dto';
import { InvitacionesService } from './invitaciones.service';

/** Historia 1.5. Consultar y aceptar el enlace de invitación: sin sesión. */
@ApiTags('invitaciones')
@Controller('auth/invitaciones')
export class InvitacionesController {
  constructor(
    private readonly invitaciones: InvitacionesService,
    private readonly sesiones: SesionesService,
  ) {}

  @Get(':token')
  @Publico()
  @ApiOperation({
    summary: 'Estado del enlace de invitación',
    description:
      'Siempre 200 con la misma forma: `vigente`, o `invalida` con su motivo (usada, caducada, reemplazada, desconocida). Solo trae el nombre de la empresa y si hay que elegir contraseña.',
  })
  @ApiParam({ name: 'token', description: 'Token del enlace del correo.' })
  @ApiOkResponse({ type: EstadoInvitacionDto })
  consultar(@Param('token') token: string): Promise<EstadoInvitacionDto> {
    return this.invitaciones.consultar(token);
  }

  @Post(':token/aceptar')
  @Publico()
  // Por IP y solo cuentan los fallos: aceptar bien no consume (AD-15).
  @Limite({ intentos: 10, ventanaS: 60 })
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Acepta la invitación: cuenta, rol admin, consumo del enlace y sesión',
    description:
      'Cuenta nueva: exige `nombre` y `password`. Cuenta existente: no se lee ni se cambia su contraseña. Abre sesión con la empresa elegida y pone la cookie.',
  })
  @ApiParam({ name: 'token', description: 'Token del enlace del correo.' })
  @ApiOkResponse({ type: InvitacionAceptadaDto })
  @ApiBadRequestResponse({
    description: 'Cuenta nueva sin nombre o con contraseña demasiado corta.',
  })
  @ApiForbiddenResponse({ description: 'La cuenta está desactivada.' })
  @ApiNotFoundResponse({ description: 'El enlace no existe.' })
  @ApiGoneResponse({
    description: 'El enlace ya se usó, venció o fue reemplazado (`motivo`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos fallidos. Trae `Retry-After`.',
  })
  async aceptar(
    @Param('token') token: string,
    @Body() dto: AceptarInvitacionDto,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<InvitacionAceptadaDto> {
    const { resultado, token: sesion } = await this.invitaciones.aceptar(
      token,
      dto,
    );
    // Como el login: entrar con una cookie vieja no deja esa sesión viva.
    const anterior = leerCookie(solicitud);
    if (anterior) await this.sesiones.cerrar(anterior);
    fijarCookieSesion(respuesta, sesion);
    return resultado;
  }
}
