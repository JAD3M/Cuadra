import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Publico, Scope, UsuarioActual } from './decoradores';
import { LoginDto } from './dto/LoginDto';
import {
  EmpresaDisponibleDto,
  RespuestaErrorDto,
  RespuestaLoginDto,
  RespuestaTokenDto,
} from './dto/respuestas.dto';
import type { UsuarioAutenticado } from './tipos';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia sesión y devuelve un token de selección (D-09)',
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
  async login(@Body() dto: LoginDto): Promise<RespuestaLoginDto> {
    return await this.authService.login(dto.email, dto.password);
  }

  @Get('empresas')
  @Scope('seleccion')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Empresas que puede elegir el usuario del token de selección',
    description:
      'La misma lista que devuelve el login, para no perderla si se recarga la página.',
  })
  @ApiOkResponse({ type: [EmpresaDisponibleDto] })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Falta el token, expiró o no es de selección.',
  })
  async empresas(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EmpresaDisponibleDto[]> {
    return await this.authService.consultarCompanies(usuario.userId);
  }

  @Post('empresa/:id')
  @Scope('seleccion')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Canjea el token de selección por uno de sesión en esa empresa',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Id de la empresa' })
  @ApiOkResponse({ type: RespuestaTokenDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiUnauthorizedResponse({
    type: RespuestaErrorDto,
    description: 'Falta el token, expiró o no es de selección.',
  })
  @ApiForbiddenResponse({
    type: RespuestaErrorDto,
    description: 'El usuario no tiene roles vigentes en esa empresa.',
  })
  async seleccionarEmpresa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) companyId: string,
  ): Promise<RespuestaTokenDto> {
    return await this.authService.seleccionarEmpresa(usuario.userId, companyId);
  }
}
