import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { LoginDto } from '../auth/dto/LoginDto';
import { leerCookie } from '../auth/guards/sesion-cookie.guard';
import {
  COOKIE_SESION,
  fijarCookieSesion,
  OPCIONES_COOKIE,
  SesionesService,
} from '../auth/sesiones.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import {
  Publico,
  Scope,
  UsuarioActual,
} from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import { RespuestaLoginPlataformaDto } from './dto/plataforma.dto';
import { PlataformaAuthService } from './plataforma-auth.service';
import { RegistroPlataforma } from './registro-plataforma.service';

/**
 * Login y logout del dueño (AD-5). Públicos como los de empresa; el
 * `OrigenGuard` y el límite de intentos son globales y corren igual aquí.
 */
@ApiTags('plataforma')
@Controller('plataforma/auth')
@Scope('plataforma')
export class PlataformaAuthController {
  constructor(
    private readonly auth: PlataformaAuthService,
    private readonly sesiones: SesionesService,
    private readonly registro: RegistroPlataforma,
  ) {}

  @Post('login')
  @Publico()
  // Por IP y solo cuentan los fallos, igual que el login de empresa (AD-15).
  @Limite({ intentos: 5, ventanaS: 60 })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia la sesión del dueño de Cuadra y pone la cookie',
    description:
      'Abre una sesión de tipo `plataforma`, sin empresa. La cookie es la misma `cuadra_sesion`; el cuerpo no lleva token.',
  })
  @ApiOkResponse({ type: RespuestaLoginPlataformaDto })
  @ApiBadRequestResponse({ description: 'Falta correo o contraseña.' })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas. Mismo mensaje en cualquier caso.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Más de 5 intentos fallidos en un minuto desde la misma IP.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaLoginPlataformaDto> {
    const { token, usuario } = await this.auth.login(dto.email, dto.password);
    // Entrar de nuevo con una cookie vieja no deja la sesión anterior viva.
    const anterior = leerCookie(solicitud);
    if (anterior) await this.sesiones.cerrar(anterior);
    fijarCookieSesion(respuesta, token);
    await this.registro.registrar({
      accion: 'iniciar_sesion_plataforma',
      plataformaUsuarioId: usuario.id,
      detalle: { ip: solicitud.ip ?? null },
    });
    return { usuario };
  }

  /**
   * Solo lectura y no deja fila en la bitácora: el frontend la llama en cada
   * carga de página. El guard ya rechazó sesiones ajenas (403 con bitácora).
   */
  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Dueño de la sesión de plataforma vigente',
    description:
      'Sirve para restaurar la sesión tras recargar. No escribe en la bitácora.',
  })
  @ApiOkResponse({ type: RespuestaLoginPlataformaDto })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión, venció, o la cuenta ya no está activa.',
  })
  @ApiForbiddenResponse({
    description: 'La sesión no es de plataforma. Queda en la bitácora.',
  })
  async me(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<RespuestaLoginPlataformaDto> {
    if (actual.scope !== 'plataforma') {
      throw new UnauthorizedException('No autorizado');
    }
    return { usuario: await this.auth.perfil(actual.plataformaUsuarioId) };
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierra la sesión del dueño: borra la fila y la cookie',
    description: 'Idempotente: sin cookie o con una ya cerrada también da 204.',
  })
  @ApiNoContentResponse()
  async logout(
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    const token = leerCookie(solicitud);
    if (token) {
      const sesion = await this.sesiones.buscarPorToken(token);
      await this.sesiones.cerrar(token);
      // Solo una sesión de plataforma deja fila: este no es el logout de empresa.
      if (sesion?.tipo === 'plataforma' && sesion.plataformaUsuarioId) {
        await this.registro.registrar({
          accion: 'cerrar_sesion_plataforma',
          plataformaUsuarioId: sesion.plataformaUsuarioId,
          detalle: { ip: solicitud.ip ?? null },
        });
      }
    }
    respuesta.clearCookie(COOKIE_SESION, OPCIONES_COOKIE);
  }
}
