import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import { TasaDeDesacuerdoDto } from './dto/tasa-de-desacuerdo.dto';
import { SombraService } from './sombra.service';

/** La sesión (cookie, AD-6) ya la exige el guard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/**
 * Historia 9.1 (FR-36, AD-10, AD-11). La medición de la empresa del
 * administrador: la empresa sale de la sesión, nunca de la petición.
 */
@ApiTags('medicion')
@ApiCookieAuth()
@Controller('medicion')
export class MedicionController {
  constructor(private readonly sombra: SombraService) {}

  @Get('desacuerdo')
  @Permiso('medicion.ver')
  @ApiOperation({
    summary:
      'Tasa de desacuerdo de la empresa con las propuestas de la regla 1',
    description:
      'Se calcula en cada consulta sobre los eventos del modo sombra, con la definición de la historia 6.2; no es un número guardado. `tasa` es `null` mientras no haya propuestas tratadas.',
  })
  @ApiOkResponse({ type: TasaDeDesacuerdoDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión o venció.' })
  @ApiForbiddenResponse({
    description: 'No tiene el rol admin. Queda en la bitácora.',
  })
  desacuerdo(@UsuarioActual() actual: Sesion): Promise<TasaDeDesacuerdoDto> {
    return this.sombra.tasaDesacuerdo(actual.companyId);
  }
}
