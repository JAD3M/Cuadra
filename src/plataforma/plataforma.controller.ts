import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Scope } from '../common/decorators/decoradores';
import { EmpresaPlataformaDto } from './dto/plataforma.dto';

/** Rutas de la pantalla interna del dueño (AD-5): solo sesión `plataforma`. */
@ApiTags('plataforma')
@Controller('plataforma')
@Scope('plataforma')
export class PlataformaController {
  /**
   * Historia 1.3: la lista empieza vacía. `companies` tiene RLS FORCE y no
   * hay una vía de lectura sin `company_id` que no la rodee; leerla es de la
   * historia 1.4, junto con crear empresas. Hasta entonces es un marcador.
   */
  @Get('empresas')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Empresas de la plataforma (vacía al inicio)' })
  @ApiOkResponse({ type: [EmpresaPlataformaDto] })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'La sesión no es de plataforma. Queda en la bitácora.',
  })
  empresas(): EmpresaPlataformaDto[] {
    return [];
  }
}
