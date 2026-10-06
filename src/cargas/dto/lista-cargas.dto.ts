import { ApiProperty } from '@nestjs/swagger';
import {
  ESTADOS_CARGA,
  type EstadoCarga,
  TIPOS_CARGA,
  type TipoCarga,
} from '../../common/entities/tipos';

/** Una carga en el historial de GET /cargas (CU-24). Sin `resultados`. */
export class CargaListadaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TIPOS_CARGA }) tipo: TipoCarga;
  @ApiProperty({
    description: 'Nombre del archivo; en un lote de CFDI, el resumen del lote.',
  })
  nombreArchivo: string;
  @ApiProperty({ enum: ESTADOS_CARGA }) estado: EstadoCarga;
  @ApiProperty({ description: 'Archivos del lote o filas de datos del CSV.' })
  totalRegistros: number;
  @ApiProperty({ description: 'Registros que entraron.' })
  registrosOk: number;
  @ApiProperty({ description: 'CFDI cuyo UUID ya estaba en la empresa.' })
  registrosExistentes: number;
  @ApiProperty({ description: 'Registros que no entraron.' })
  registrosError: number;
  @ApiProperty({ nullable: true, type: String })
  banco: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Perfil de banco con el que se leyó el estado de cuenta.',
  })
  perfil: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "Solo en 'fallida': mensaje genérico.",
  })
  errorMensaje: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Nombre de quien subió la carga; null si ya no existe.',
  })
  subidoPor: string | null;
  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' }) createdAt: string;
  @ApiProperty({ nullable: true, type: String })
  procesadaAt: string | null;
}

export class RespuestaListaCargasDto {
  @ApiProperty({
    type: [CargaListadaDto],
    description:
      'Las 20 cargas más recientes de la empresa, la más nueva primero.',
  })
  datos: CargaListadaDto[];
}
