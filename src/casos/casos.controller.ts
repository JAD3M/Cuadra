import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { UsuarioActual } from '../common/decorators/decoradores';
import { CasosService } from './casos.service';
import { RespuestaCasoDto } from './dto/caso.dto';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-23. Detalle de un caso: cualquier miembro de la empresa, solo lectura. */
@ApiBearerAuth()
@Controller('casos')
export class CasosController {
  constructor(private readonly casos: CasosService) {}

  @Get(':movimientoId')
  @ApiOkResponse({ type: RespuestaCasoDto })
  @ApiBadRequestResponse({ description: 'El id no es un UUID.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  @ApiNotFoundResponse({
    description: 'El movimiento no existe o es de otra empresa.',
  })
  @ApiForbiddenResponse({ description: 'Sin membresía vigente en la empresa.' })
  obtener(
    @UsuarioActual() usuario: Sesion,
    @Param('movimientoId', new ParseUUIDPipe()) movimientoId: string,
  ): Promise<RespuestaCasoDto> {
    return this.casos.obtener(usuario.companyId, movimientoId);
  }
}
