import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
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
import { Publico } from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import {
  ContrasenaRestablecidaDto,
  EstadoRecuperacionDto,
  RestablecerContrasenaDto,
  SolicitarRecuperacionDto,
  SolicitudRecibidaDto,
} from './dto/recuperacion.dto';
import {
  MENSAJE_RESTABLECIDA,
  MENSAJE_SOLICITUD,
  RecuperacionService,
} from './recuperacion.service';

/** Historia 1.6. Recuperar la contraseña por correo: todo sin sesión. */
@ApiTags('recuperacion')
@Controller('auth/recuperacion')
export class RecuperacionController {
  constructor(private readonly recuperacion: RecuperacionService) {}

  @Post()
  @Publico()
  // Por IP y cuenta también los éxitos: cada petición puede mandar un correo
  // (AD-15, como invitar), así que no se dispara sin fin.
  @Limite({ intentos: 5, ventanaS: 3600, contarExitos: true })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Pide un enlace para restablecer la contraseña',
    description:
      'Responde igual exista o no la cuenta, o esté inactiva: no revela quién tiene una. Si existe, reemplaza el enlace vivo y envía uno nuevo por correo (vigencia de 1 hora).',
  })
  @ApiOkResponse({ type: SolicitudRecibidaDto })
  @ApiBadRequestResponse({ description: 'El correo no tiene forma válida.' })
  @ApiTooManyRequestsResponse({
    description: 'Demasiadas solicitudes. Trae `Retry-After`.',
  })
  async solicitar(
    @Body() dto: SolicitarRecuperacionDto,
  ): Promise<SolicitudRecibidaDto> {
    await this.recuperacion.solicitar(dto.email);
    return { mensaje: MENSAJE_SOLICITUD };
  }

  @Get(':token')
  @Publico()
  @ApiOperation({
    summary: 'Estado del enlace de recuperación',
    description:
      'Siempre 200 con la misma forma: `vigente`, o `invalida` con su motivo (usada, caducada, reemplazada, desconocida). No trae datos de la cuenta.',
  })
  @ApiParam({ name: 'token', description: 'Token del enlace del correo.' })
  @ApiOkResponse({ type: EstadoRecuperacionDto })
  consultar(@Param('token') token: string): Promise<EstadoRecuperacionDto> {
    return this.recuperacion.consultar(token);
  }

  @Post(':token')
  @Publico()
  // Por IP y solo cuentan los fallos: restablecer bien no consume (AD-15).
  @Limite({ intentos: 10, ventanaS: 60 })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Restablece la contraseña con el enlace',
    description:
      'Cambia la contraseña, consume el enlace y cierra todas las sesiones de la cuenta. No abre sesión: la persona entra por el login.',
  })
  @ApiParam({ name: 'token', description: 'Token del enlace del correo.' })
  @ApiOkResponse({ type: ContrasenaRestablecidaDto })
  @ApiBadRequestResponse({
    description: 'La contraseña no cumple la política (mínimo 12 caracteres).',
  })
  @ApiForbiddenResponse({ description: 'La cuenta está desactivada.' })
  @ApiNotFoundResponse({ description: 'El enlace no existe.' })
  @ApiGoneResponse({
    description: 'El enlace ya se usó, venció o fue reemplazado (`motivo`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos fallidos. Trae `Retry-After`.',
  })
  async restablecer(
    @Param('token') token: string,
    @Body() dto: RestablecerContrasenaDto,
  ): Promise<ContrasenaRestablecidaDto> {
    await this.recuperacion.restablecer(token, dto.password);
    return { mensaje: MENSAJE_RESTABLECIDA };
  }
}
