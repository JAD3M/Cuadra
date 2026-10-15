import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import {
  InvitacionCanceladaDto,
  InvitacionPendienteDto,
  InvitacionUsuarioEnviadaDto,
  InvitarUsuarioDto,
  UsuarioListadoDto,
} from './dto/usuarios.dto';
import { InvitacionesPendientesService } from './invitaciones-pendientes.service';
import { InvitarUsuariosService } from './invitar-usuarios.service';
import { ListarUsuariosService } from './listar-usuarios.service';

/**
 * Historias 2.3 a 2.5 (FR-41, FR-42, FR-47, FR-50). Solo `admin`:
 * `usuarios.gestionar` para invitar, reenviar y cancelar; `usuarios.ver` para
 * listar personas y pendientes.
 */
@ApiTags('usuarios')
@ApiCookieAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly invitaciones: InvitarUsuariosService,
    private readonly pendientes: InvitacionesPendientesService,
    private readonly usuarios: ListarUsuariosService,
  ) {}

  @Get()
  @Permiso('usuarios.ver')
  @ApiOperation({
    summary: 'Lista a las personas de la empresa con su estado',
    description:
      'Una fila por persona: activas con sus roles en esta empresa, e invitaciones pendientes (con `vencida`). Una persona activa con invitación abierta sale solo como activa. Orden por correo.',
  })
  @ApiOkResponse({ type: UsuarioListadoDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  listarUsuarios(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<UsuarioListadoDto[]> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.usuarios.listar(actual.companyId);
  }

  @Post('invitaciones')
  @Permiso('usuarios.gestionar')
  // Mismo tope que invitar desde plataforma: manda un correo por petición.
  @Limite({ intentos: 20, ventanaS: 3600, contarExitos: true })
  @ApiOperation({
    summary: 'Invita por correo a una persona a la empresa con uno o más roles',
    description:
      'La respuesta es idéntica exista o no la cuenta de ese correo. Una invitación nueva al mismo correo invalida la anterior. El enlace sirve una vez y vence en 7 días; la acción queda en la bitácora de la empresa.',
  })
  @ApiCreatedResponse({ type: InvitacionUsuarioEnviadaDto })
  @ApiBadRequestResponse({
    description:
      'El correo no es válido o los roles están vacíos o no existen.',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados envíos desde la misma dirección.',
  })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo enviar el correo; invita de nuevo.',
  })
  invitar(
    @Body() dto: InvitarUsuarioDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InvitacionUsuarioEnviadaDto> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.invitaciones.invitar(
      actual.companyId,
      actual.userId,
      dto.email,
      dto.roles,
    );
  }

  @Get('invitaciones')
  @Permiso('usuarios.ver')
  @ApiOperation({
    summary: 'Lista las invitaciones pendientes de la empresa',
    description:
      'Pendiente: ni aceptada, ni reemplazada, ni cancelada. Las vencidas se incluyen con `vencida: true`. Las más recientes primero. Nunca trae el token ni su huella.',
  })
  @ApiOkResponse({ type: InvitacionPendienteDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  listar(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InvitacionPendienteDto[]> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.pendientes.listar(actual.companyId);
  }

  @Post('invitaciones/:id/reenviar')
  @Permiso('usuarios.gestionar')
  @Limite({ intentos: 20, ventanaS: 3600, contarExitos: true })
  @ApiOperation({
    summary: 'Reenvía una invitación pendiente con un enlace nuevo',
    description:
      'El enlace anterior deja de servir y la caducidad vuelve a contar 7 días. Conserva correo y roles; queda en la bitácora con quien reenvía.',
  })
  @ApiCreatedResponse({ type: InvitacionUsuarioEnviadaDto })
  @ApiBadRequestResponse({ description: 'El id no es un uuid.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  @ApiNotFoundResponse({
    description: 'La invitación no existe en esta empresa.',
  })
  @ApiConflictResponse({
    description: 'Ya fue aceptada, reemplazada o cancelada. No cambia nada.',
  })
  @ApiTooManyRequestsResponse({ description: 'Demasiadas peticiones.' })
  @ApiServiceUnavailableResponse({
    description: 'No se pudo enviar el correo; reenvía de nuevo.',
  })
  reenviar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InvitacionUsuarioEnviadaDto> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.pendientes.reenviar(actual.companyId, actual.userId, id);
  }

  @Post('invitaciones/:id/cancelar')
  @HttpCode(200)
  @Permiso('usuarios.gestionar')
  @Limite({ intentos: 20, ventanaS: 3600, contarExitos: true })
  @ApiOperation({
    summary: 'Cancela una invitación pendiente',
    description:
      'El enlace deja de servir (motivo `cancelada`) y la invitación sale de la lista de pendientes. No se avisa a la persona invitada. Queda en la bitácora con quien canceló.',
  })
  @ApiOkResponse({ type: InvitacionCanceladaDto })
  @ApiBadRequestResponse({ description: 'El id no es un uuid.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  @ApiNotFoundResponse({
    description: 'La invitación no existe en esta empresa.',
  })
  @ApiConflictResponse({
    description: 'Ya fue aceptada, reemplazada o cancelada. No cambia nada.',
  })
  @ApiTooManyRequestsResponse({ description: 'Demasiadas peticiones.' })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InvitacionCanceladaDto> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.pendientes.cancelar(actual.companyId, actual.userId, id);
  }
}
