import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import {
  ActualizarToleranciaDto,
  ToleranciaRespuestaDto,
} from './dto/tolerancia.dto';
import { ToleranciaService } from './tolerancia.service';

/** La sesión (cookie, AD-6) ya la exige SesionCookieGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

/** CU-12. Configuración de la empresa de la sesión. */
@ApiCookieAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly tolerancia: ToleranciaService) {}

  /** Cualquier miembro de la empresa. */
  @Get('tolerancia')
  async obtener(
    @UsuarioActual() usuario: Sesion,
  ): Promise<ToleranciaRespuestaDto> {
    return {
      toleranciaMonto: await this.tolerancia.obtener(usuario.companyId),
    };
  }

  /** Solo admin. Aplica desde la siguiente conciliación; no la vuelve a correr. */
  @Put('tolerancia')
  @Roles('admin')
  async actualizar(
    @UsuarioActual() usuario: Sesion,
    @Body() cuerpo: ActualizarToleranciaDto,
    @Req() solicitud: Request,
  ): Promise<ToleranciaRespuestaDto> {
    const toleranciaMonto = await this.tolerancia.actualizar(
      usuario.companyId,
      cuerpo.toleranciaMonto,
      {
        userId: usuario.userId,
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
      },
    );
    return { toleranciaMonto };
  }
}
