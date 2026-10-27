import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CambiarRolesService } from './cambiar-roles.service';
import {
  CambiarRolesDto,
  InvitacionCanceladaDto,
  InvitacionPendienteDto,
  InvitacionUsuarioEnviadaDto,
  InvitarUsuarioDto,
  UsuarioListadoDto,
  UsuarioRolesDto,
} from './dto/usuarios.dto';
import { InvitacionesPendientesService } from './invitaciones-pendientes.service';
import { InvitarUsuariosService } from './invitar-usuarios.service';
import { ListarUsuariosService } from './listar-usuarios.service';

/**
 * Historias 2.3 a 2.6 (FR-41, FR-42, FR-45 a FR-47, FR-50). Solo `admin`:
 * `usuarios.gestionar` para invitar, reenviar, cancelar y cambiar o quitar
 * roles; `usuarios.ver` para
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
    private readonly roles: CambiarRolesService,
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

  @Patch(':id/roles')
  @Permiso('usuarios.gestionar')
  @ApiOperation({
    summary: 'Cambia los roles de una persona en la empresa',
    description:
      'Reemplaza el conjunto de roles (1 a 4, sin repetidos) en esta empresa; no toca los de otras. Aplica en la siguiente petición de esa persona y queda en la bitácora como `cambiar_rol` con los roles antes y después. Si el conjunto no cambia, responde 200 sin registrar nada. Para quitar todo el acceso se usa DELETE.',
  })
  @ApiOkResponse({ type: UsuarioRolesDto })
  @ApiBadRequestResponse({
    description:
      'El id no es un uuid, o los roles están vacíos, son más de cuatro o no existen.',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  @ApiNotFoundResponse({
    description: 'La persona no tiene roles en esta empresa.',
  })
  @ApiConflictResponse({
    description: 'Dejaría a la empresa sin administrador. No cambia nada.',
  })
  cambiarRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarRolesDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<UsuarioRolesDto> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.roles.cambiar(actual.companyId, actual.userId, id, dto.roles);
  }

  @Delete(':id/roles')
  @Permiso('usuarios.gestionar')
  @ApiOperation({
    summary: 'Quita el acceso de una persona a la empresa',
    description:
      'Borra todos sus roles en esta empresa y cierra sus sesiones elegidas en ella; conserva sus roles y sesiones en otras empresas. Queda en la bitácora como `quitar_rol` con los roles quitados.',
  })
  @ApiOkResponse({ type: UsuarioRolesDto })
  @ApiBadRequestResponse({ description: 'El id no es un uuid.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  @ApiNotFoundResponse({
    description: 'La persona no tiene roles en esta empresa.',
  })
  @ApiConflictResponse({
    description: 'Es el único administrador de la empresa. No cambia nada.',
  })
  quitarAcceso(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<UsuarioRolesDto> {
    if (actual.scope !== 'sesion') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.roles.quitar(actual.companyId, actual.userId, id);
  }
}
