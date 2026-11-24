import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import {
  MarcaGuardadaDto,
  MuestraDto,
  VerificarMuestraDto,
} from './dto/muestra.dto';
import { VerificacionMuestraService } from './verificacion-muestra.service';

type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/**
 * Historia 9.4 (FR-63, AD-10, AD-11). La empresa sale de la sesión, nunca de la
 * petición. Leer es de revisor, admin y auditor; marcar, de revisor y admin, y
 * además el servidor aplica las reglas de quién puede (ver el servicio).
 */
@ApiTags('muestra')
@ApiCookieAuth()
@Controller('muestra')
export class MuestraController {
  constructor(private readonly verificacion: VerificacionMuestraService) {}

  @Get()
  @Permiso('muestra.ver')
  @ApiOperation({
    summary: 'La muestra de verificación del mes, con su avance',
    description:
      'Sin `mes` devuelve la más reciente. Cada caso trae `puedeMarcar` según el servidor.',
  })
  @ApiQuery({ name: 'mes', required: false, example: '2026-09' })
  @ApiOkResponse({ type: MuestraDto })
  @ApiBadRequestResponse({ description: 'El mes no es AAAA-MM.' })
  @ApiForbiddenResponse({ description: 'Rol sin el permiso.' })
  leer(
    @UsuarioActual() usuario: Sesion,
    @Query('mes') mes?: string,
  ): Promise<MuestraDto> {
    return this.verificacion.leer(usuario.companyId, usuario.userId, mes);
  }

  @Post('casos/:decisionId/verificar')
  @Permiso('muestra.verificar')
  @ApiOperation({
    summary: 'Marcar un caso de la muestra como conforme o en desacuerdo',
    description:
      'Cada marca es una fila nueva y vale la última. No reabre nada: en desacuerdo se usa la reapertura (5.7).',
  })
  @ApiCreatedResponse({ type: MarcaGuardadaDto })
  @ApiBadRequestResponse({ description: 'Id o resultado inválido.' })
  @ApiNotFoundResponse({ description: 'No está en la muestra de la empresa.' })
  @ApiForbiddenResponse({
    description:
      'Rol sin el permiso, el admin con revisores en la empresa, o quien confirmó el lote habiendo otra persona.',
  })
  @ApiConflictResponse({
    description: 'La conciliación ya no está confirmada.',
  })
  verificar(
    @UsuarioActual() usuario: Sesion,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @Body() cuerpo: VerificarMuestraDto,
    @Req() solicitud: Request,
  ): Promise<MarcaGuardadaDto> {
    return this.verificacion.verificar(
      usuario.companyId,
      decisionId,
      cuerpo.resultado,
      {
        userId: usuario.userId,
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
        metodo: solicitud.method,
        ruta: solicitud.path,
      },
    );
  }
}
