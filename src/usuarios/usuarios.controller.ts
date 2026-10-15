import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
  InvitacionUsuarioEnviadaDto,
  InvitarUsuarioDto,
} from './dto/usuarios.dto';
import { InvitarUsuariosService } from './invitar-usuarios.service';

/** Historia 2.3 (FR-41, FR-50). Solo `admin` (`usuarios.gestionar`). */
@ApiTags('usuarios')
@ApiCookieAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly invitaciones: InvitarUsuariosService) {}

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
}
