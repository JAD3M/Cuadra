import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Lo que una persona puede marcar en un caso de la muestra (9.4). */
export const RESULTADOS_MUESTRA = ['conforme', 'desacuerdo'] as const;
export type ResultadoMuestra = (typeof RESULTADOS_MUESTRA)[number];

export type MarcaMuestra = 'pendiente' | ResultadoMuestra;

export class VerificarMuestraDto {
  @ApiProperty({
    enum: RESULTADOS_MUESTRA,
    description:
      'Conforme o en desacuerdo. En desacuerdo no reabre nada: quien lo decide usa la reapertura (5.7).',
  })
  @IsIn(RESULTADOS_MUESTRA, {
    message: 'El resultado debe ser «conforme» o «desacuerdo»',
  })
  resultado: ResultadoMuestra;
}

export class CfdiMuestraDto {
  @ApiProperty() id: string;
  @ApiProperty() uuidFiscal: string;
  @ApiProperty({ nullable: true, type: String }) serie: string | null;
  @ApiProperty({ nullable: true, type: String }) folio: string | null;
  @ApiProperty({ nullable: true, type: String }) nombreEmisor: string | null;
  @ApiProperty({ nullable: true, type: String }) nombreReceptor: string | null;
  @ApiProperty({ description: 'Monto exacto, como texto.' }) total: string;
  @ApiProperty() moneda: string;
}

export class MarcaDeCasoDto {
  @ApiProperty({ description: 'Nombre de quien marcó.' }) quien: string;
  @ApiProperty({ enum: RESULTADOS_MUESTRA }) resultado: ResultadoMuestra;
  @ApiProperty({ description: 'Fecha y hora (ISO 8601).' }) cuando: string;
}

export class CasoMuestraDto {
  @ApiProperty() decisionId: string;
  @ApiProperty({ description: 'Para enlazar al detalle del caso (5.7).' })
  movimientoId: string;
  @ApiProperty({ description: 'Fecha del movimiento, AAAA-MM-DD.' })
  fecha: string;
  @ApiProperty() descripcion: string;
  @ApiProperty({ nullable: true, type: String }) referencia: string | null;
  @ApiProperty({ description: 'Monto exacto, como texto.' }) monto: string;
  @ApiProperty() moneda: string;
  @ApiProperty({ nullable: true, type: String }) banco: string | null;
  @ApiProperty({ nullable: true, type: String }) regla: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Por qué el motor propuso esta conciliación, tal como se guardó.',
  })
  motivo: string | null;
  @ApiProperty({ type: [CfdiMuestraDto] }) cfdis: CfdiMuestraDto[];
  @ApiProperty({ nullable: true, type: String }) confirmadaPor: string | null;
  @ApiProperty({ description: 'Quien consulta es quien confirmó el lote.' })
  confirmadaPorMi: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601.' })
  confirmadaAt: string | null;
  @ApiProperty({ enum: ['pendiente', ...RESULTADOS_MUESTRA] })
  marca: MarcaMuestra;
  @ApiProperty({ nullable: true, type: String }) marcadaPor: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'ISO 8601.' })
  marcadaAt: string | null;
  @ApiProperty({
    type: [MarcaDeCasoDto],
    description: 'Todas las marcas del caso, la más reciente primero.',
  })
  marcas: MarcaDeCasoDto[];
  @ApiProperty({
    description:
      'La decisión ya no está confirmada: se muestra, pero no se marca.',
  })
  reabierta: boolean;
  @ApiProperty({
    description:
      'Lo que el servidor permite a quien consulta: el rol, que quien confirmó el lote no lo verifique si hay otra persona, y que no esté reabierta.',
  })
  puedeMarcar: boolean;
}

export class AvanceMuestraDto {
  @ApiProperty() total: number;
  @ApiProperty() conformes: number;
  @ApiProperty() desacuerdos: number;
  @ApiProperty({
    description:
      'Sin marca y todavía confirmados: los que faltan por verificar.',
  })
  pendientes: number;
  @ApiProperty({
    description:
      'Reabiertos sin marca: ya no se verifican, no cuentan como pendientes.',
  })
  reabiertas: number;
}

export class MuestraDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Mes mostrado (AAAA-MM); nulo si la empresa no tiene muestra.',
  })
  mes: string | null;
  @ApiProperty({
    type: [String],
    description: 'Meses con muestra, el más reciente primero.',
  })
  meses: string[];
  @ApiProperty({ type: AvanceMuestraDto }) avance: AvanceMuestraDto;
  @ApiProperty({
    description:
      'La empresa no tiene a nadie con el rol revisor: verifica el administrador.',
  })
  sinRevisor: boolean;
  @ApiProperty({
    description: 'Quien consulta es de las personas que pueden verificar.',
  })
  puedeVerificar: boolean;
  @ApiProperty({ type: [CasoMuestraDto] }) casos: CasoMuestraDto[];
}

export class MarcaGuardadaDto {
  @ApiProperty() decisionId: string;
  @ApiProperty({ enum: RESULTADOS_MUESTRA }) marca: ResultadoMuestra;
  @ApiProperty({ description: 'Nombre de quien marcó.' }) marcadaPor: string;
  @ApiProperty({ description: 'Fecha y hora (ISO 8601).' }) marcadaAt: string;
}
