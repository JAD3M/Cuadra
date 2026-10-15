import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Permiso, UsuarioActual } from '../common/decorators/decoradores';
import {
  ArchivosXmlGuard,
  CAMPO_ARCHIVOS,
  CAMPO_ESTADO_CUENTA,
  EstadoDeCuentaGuard,
} from './archivos.guard';
import { EstadoCuentaDto } from './dto/estado-cuenta.dto';
import { RespuestaListaCargasDto } from './dto/lista-cargas.dto';
import {
  type ArchivoSubido,
  CargasService,
  type EstadoDeCarga,
  type RespuestaDeCarga,
} from './cargas.service';
import { YaExistiaInterceptor } from './ya-existia.interceptor';

/** La sesión (cookie, AD-6) ya la exige SesionCookieGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

@ApiCookieAuth()
@Controller('cargas')
export class CargasController {
  constructor(private readonly cargas: CargasService) {}

  /**
   * CU-06, CU-07 y CU-08. 202 con la carga nueva en 'pendiente': el
   * resultado por archivo se consulta con GET cuando el worker termina. 200
   * con la carga original, en el estado en que esté, y `yaExistia` si el
   * lote ya se había cargado.
   */
  @Post('cfdi')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permiso('cargas.cargar')
  @UseGuards(ArchivosXmlGuard)
  @UseInterceptors(YaExistiaInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        [CAMPO_ARCHIVOS]: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  cargarCfdi(
    @UsuarioActual() usuario: Sesion,
    @UploadedFiles() archivos: ArchivoSubido[],
  ): Promise<RespuestaDeCarga> {
    return this.cargas.cargarCfdi(usuario.companyId, usuario.userId, archivos);
  }

  /**
   * CU-09. Un CSV en el formato canónico (ver CUADRA.md, `movimientos`). El
   * archivo se valida antes de guardar nada: 400 si no es UTF-8, está mal
   * formado o sus encabezados no son los exactos. Las filas malformadas se
   * reportan una por una y el resto se carga. Mismos códigos que CFDI: 202
   * nueva, 200 `yaExistia`.
   */
  @Post('estado-cuenta')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permiso('cargas.cargar')
  @UseGuards(EstadoDeCuentaGuard)
  @UseInterceptors(YaExistiaInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [CAMPO_ESTADO_CUENTA],
      properties: {
        [CAMPO_ESTADO_CUENTA]: { type: 'string', format: 'binary' },
        banco: { type: 'string', maxLength: 128 },
        cuenta: { type: 'string', maxLength: 32 },
        perfil: { type: 'string', maxLength: 64, default: 'cuadra' },
      },
    },
  })
  cargarEstadoCuenta(
    @UsuarioActual() usuario: Sesion,
    @UploadedFiles() [archivo]: ArchivoSubido[],
    @Body() cuerpo: EstadoCuentaDto,
  ): Promise<RespuestaDeCarga> {
    return this.cargas.cargarEstadoCuenta(
      usuario.companyId,
      usuario.userId,
      archivo,
      cuerpo,
    );
  }

  /**
   * CU-24. Las últimas 20 cargas de la empresa, para el historial. Con
   * `cargas.ver`: admin y contador consultan (FR-53). La empresa sale del
   * token; ni `companyId` ni `limite` en la query se leen. Va antes de
   * `:id`.
   */
  @Get()
  @ApiOkResponse({ type: RespuestaListaCargasDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida.' })
  @ApiForbiddenResponse({ description: 'Sin membresía vigente en la empresa.' })
  async listar(
    @UsuarioActual() usuario: Sesion,
  ): Promise<RespuestaListaCargasDto> {
    return { datos: await this.cargas.listar(usuario.companyId) };
  }

  /** La empresa sale del token; un `companyId` en la query no se lee. */
  @Get(':id')
  consultar(
    @UsuarioActual() usuario: Sesion,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EstadoDeCarga> {
    return this.cargas.consultar(usuario.companyId, id);
  }
}
