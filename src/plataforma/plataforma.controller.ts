import {
  Body,
  Controller,
  Get,
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
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Scope, UsuarioActual } from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import {
  CrearEmpresaDto,
  EmpresaPlataformaDto,
  InvitacionEnviadaDto,
  InvitarAdminDto,
} from './dto/plataforma.dto';
import { EmpresasPlataforma } from './empresas-plataforma.service';
import { InvitacionesPlataforma } from './invitaciones-plataforma.service';

/** Rutas de la pantalla interna del dueño (AD-5): solo sesión `plataforma`. */
@ApiTags('plataforma')
@Controller('plataforma')
@Scope('plataforma')
export class PlataformaController {
  constructor(
    private readonly empresas: EmpresasPlataforma,
    private readonly invitaciones: InvitacionesPlataforma,
  ) {}

  /**
   * `companies` no tiene RLS (AislamientoRls la deja fuera): la lista no
   * necesita `company_id` y no abre una transacción de empresa.
   */
  @Get('empresas')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Empresas de la plataforma' })
  @ApiOkResponse({ type: [EmpresaPlataformaDto] })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'La sesión no es de plataforma. Queda en la bitácora.',
  })
  listar(): Promise<EmpresaPlataformaDto[]> {
    return this.empresas.listar();
  }

  @Post('empresas')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Crea una empresa con su RFC',
    description:
      'Normaliza el RFC en el servidor. La empresa nace con la separación de funciones activa y la acción queda en las dos bitácoras, en una sola transacción.',
  })
  @ApiCreatedResponse({ type: EmpresaPlataformaDto })
  @ApiBadRequestResponse({
    description: 'Falta la razón social o el RFC es inválido o genérico.',
  })
  @ApiConflictResponse({ description: 'El RFC ya pertenece a otra empresa.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'La sesión no es de plataforma. Queda en la bitácora.',
  })
  crear(
    @Body() dto: CrearEmpresaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<EmpresaPlataformaDto> {
    if (actual.scope !== 'plataforma') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.empresas.crear(dto, actual.plataformaUsuarioId);
  }

  @Post('empresas/:id/invitaciones')
  // Manda un correo por petición: cuenta también los envíos exitosos.
  @Limite({ intentos: 20, ventanaS: 3600, contarExitos: true })
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Invita por correo a la primera persona administradora',
    description:
      'La respuesta es idéntica exista o no la cuenta de ese correo. Una invitación nueva al mismo correo invalida la anterior. El enlace sirve una vez y vence en 7 días; la acción queda en las dos bitácoras.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Id de la empresa' })
  @ApiCreatedResponse({ type: InvitacionEnviadaDto })
  @ApiBadRequestResponse({ description: 'El correo o el id no son válidos.' })
  @ApiNotFoundResponse({ description: 'La empresa no existe.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'La sesión no es de plataforma. Queda en la bitácora.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Demasiados envíos desde la misma dirección. Trae `Retry-After`.',
  })
  invitar(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() dto: InvitarAdminDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InvitacionEnviadaDto> {
    if (actual.scope !== 'plataforma') {
      throw new UnauthorizedException('No autorizado');
    }
    return this.invitaciones.invitar(
      companyId,
      dto.email,
      actual.plataformaUsuarioId,
    );
  }
}
