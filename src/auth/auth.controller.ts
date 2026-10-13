import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { leerCookie } from './guards/sesion-cookie.guard';
import {
  COOKIE_SESION,
  fijarCookieSesion,
  OPCIONES_COOKIE,
  SesionesService,
} from './sesiones.service';
import {
  Publico,
  Scope,
  UsuarioActual,
} from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import { LoginDto } from './dto/LoginDto';
import {
  ContextoSesionDto,
  EmpresaDisponibleDto,
  RespuestaErrorDto,
  RespuestaLoginDto,
} from './dto/respuestas.dto';
import type { UsuarioAutenticado } from './tipos';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sesiones: SesionesService,
  ) {}

  @Post('login')
  @Publico()
  // Por IP y solo cuentan los fallos: un login correcto no consume (AD-15).
  @Limite({ intentos: 5, ventanaS: 60 })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia sesión: abre la sesión sin empresa y pone la cookie',
    description:
      'La sesión viaja en la cookie `cuadra_sesion` (httpOnly, Secure, SameSite=Lax); el cuerpo no lleva token.',
  })
  @ApiOkResponse({ type: RespuestaLoginDto })
  @ApiBadRequestResponse({
    description: 'Falta email o contraseña, o no son válidos.',
  })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Credenciales inválidas. Mismo mensaje exista o no el email.',
  })
  @ApiForbiddenResponse({
    type: RespuestaErrorDto,
    description: 'Credenciales correctas, pero sin empresas asignadas.',
  })
  @ApiTooManyRequestsResponse({
    type: RespuestaErrorDto,
    description:
      'Más de 5 intentos fallidos en un minuto desde la misma dirección. Trae `Retry-After`.',
  })
  @ApiServiceUnavailableResponse({
    type: RespuestaErrorDto,
    description:
      'El contador de intentos no responde: se rechaza por seguridad.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaLoginDto> {
    const { token, ...cuerpo } = await this.authService.login(
      dto.email,
      dto.password,
    );
    // Entrar de nuevo con una cookie vieja no deja la sesión anterior viva.
    const anterior = leerCookie(solicitud);
    if (anterior) await this.sesiones.cerrar(anterior);
    fijarCookieSesion(respuesta, token);
    return cuerpo;
  }

  @Get('empresas')
  @Scope('seleccion', 'sesion')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Empresas que puede elegir el usuario de la sesión',
    description:
      'La misma lista que devuelve el login, con o sin empresa elegida: sirve para retomar la elección tras recargar y para cambiar de empresa.',
  })
  @ApiOkResponse({ type: [EmpresaDisponibleDto] })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Sin sesión o venció.',
  })
  async empresas(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EmpresaDisponibleDto[]> {
    return await this.authService.consultarCompanies(usuario.userId);
  }

  @Post('empresa/:id')
  @Scope('seleccion', 'sesion')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Elige o cambia la empresa de la sesión: misma fila, token rotado',
    description:
      'Sirve con la sesión sin empresa (primera elección) y con la sesión viva (cambio). Si la persona no tiene rol en la empresa responde 403 y la sesión queda igual, con el mismo token. La respuesta trae el contexto de la empresa nueva; la cookie nueva reemplaza a la anterior y la anterior deja de servir.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Id de la empresa' })
  @ApiOkResponse({ type: ContextoSesionDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Sin sesión o venció.',
  })
  @ApiForbiddenResponse({
    type: RespuestaErrorDto,
    description: 'El usuario no tiene roles vigentes en esa empresa.',
  })
  async seleccionarEmpresa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) companyId: string,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<ContextoSesionDto> {
    const token = await this.authService.seleccionarEmpresa(
      usuario.userId,
      usuario.sesionId,
      companyId,
    );
    fijarCookieSesion(respuesta, token);
    return await this.authService.contexto(usuario.userId, companyId);
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierra la sesión: borra la fila y la cookie',
    description:
      'Idempotente: sin cookie o con una ya cerrada también responde 204. El mismo token responde 401 de inmediato.',
  })
  @ApiNoContentResponse()
  async logout(
    @Req() solicitud: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    const token = leerCookie(solicitud);
    if (token) await this.sesiones.cerrar(token);
    // Mismos atributos que al emitirla, o el navegador no la reconoce.
    respuesta.clearCookie(COOKIE_SESION, OPCIONES_COOKIE);
  }

  @Get('contexto')
  @Scope('sesion')
  @ApiCookieAuth()
  @ApiOperation({
    summary:
      'Quién es el usuario, en qué empresa y con qué roles (sesión con empresa)',
    description:
      'Se lee de la base en cada llamada. No exige un rol: basta ser miembro vigente de la empresa del token.',
  })
  @ApiOkResponse({ type: ContextoSesionDto })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Sin sesión, venció o aún no tiene empresa elegida.',
  })
  @ApiForbiddenResponse({
    type: RespuestaErrorDto,
    description:
      'Ya no tiene roles vigentes en la empresa, o el usuario o la empresa fue desactivado.',
  })
  async contexto(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ContextoSesionDto> {
    // @Scope('sesion') ya lo garantiza; esto solo estrecha el tipo.
    if (usuario.scope !== 'sesion') throw new UnauthorizedException();
    return await this.authService.contexto(usuario.userId, usuario.companyId);
  }
}
