import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Scope, UsuarioActual } from '../common/decorators/decoradores';
import { CrearEmpresaDto, EmpresaPlataformaDto } from './dto/plataforma.dto';
import { EmpresasPlataforma } from './empresas-plataforma.service';

/** Rutas de la pantalla interna del dueño (AD-5): solo sesión `plataforma`. */
@ApiTags('plataforma')
@Controller('plataforma')
@Scope('plataforma')
export class PlataformaController {
  constructor(private readonly empresas: EmpresasPlataforma) {}

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
}
