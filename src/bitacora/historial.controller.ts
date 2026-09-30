import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import { BitacoraService } from './bitacora.service';
import { RespuestaHistorialDto } from './dto/bitacora.dto';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-16. Historial de una conciliación, en orden cronológico. */
@ApiBearerAuth()
@Controller('conciliaciones')
export class HistorialController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get(':id/historial')
  @Roles('admin', 'contador', 'revisor')
  @ApiOkResponse({ type: RespuestaHistorialDto })
  @ApiBadRequestResponse({ description: 'Id inválido.' })
  @ApiNotFoundResponse({ description: 'No existe en la empresa de la sesión.' })
  historial(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaHistorialDto> {
    return this.bitacora.historial(usuario.companyId, id);
  }
}
