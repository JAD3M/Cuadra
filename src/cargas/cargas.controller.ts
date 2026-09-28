import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/tipos';
import { Roles, UsuarioActual } from '../common/decorators/decoradores';
import { ArchivosXmlGuard, CAMPO_ARCHIVOS } from './archivos-xml.guard';
import {
  type ArchivoSubido,
  CargasService,
  type EstadoDeCarga,
} from './cargas.service';

/** La sesión ya la exige JwtAuthGuard; aquí solo se estrecha el tipo. */
type Sesion = Extract<UsuarioAutenticado, { scope: 'sesion' }>;

@ApiBearerAuth()
@Controller('cargas')
export class CargasController {
  constructor(private readonly cargas: CargasService) {}

  /** CU-06. 201 aunque fallen archivos: el fallo va en `errores`. */
  @Post('cfdi')
  @Roles('admin', 'contador')
  @UseGuards(ArchivosXmlGuard)
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
  ): Promise<EstadoDeCarga> {
    return this.cargas.cargarCfdi(usuario.companyId, usuario.userId, archivos);
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
