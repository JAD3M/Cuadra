// src/bancos/movimiento.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Carga } from '../cargas/carga.entity';
import { Company } from '../companies/company.entity';
import {
  ESTADOS_MOVIMIENTO,
  listaSql,
  REGLAS_SIN_MATCH,
  type EstadoMovimiento,
  type ReglaSinMatch,
} from '../common/entities/tipos';

/** Una línea del estado de cuenta bancario. */
@Entity('movimientos')
// Idempotencia al reprocesar un archivo: la misma línea del mismo estado de
// cuenta no entra dos veces. Se identifica por posición, no por contenido,
// porque dos cargos legítimos pueden ser idénticos el mismo día.
@Index(
  'ux_movimientos_company_carga_linea',
  ['companyId', 'cargaId', 'lineaNumero'],
  {
    unique: true,
  },
)
// Destino de la FK compuesta de conciliaciones (company_id, movimiento_id).
@Index('ux_movimientos_company_id_id', ['companyId', 'id'], { unique: true })
@Index('ix_movimientos_company_id_fecha_abierto', ['companyId', 'fecha'], {
  where: `estado = 'abierto'`,
})
@Index('ix_movimientos_company_id_monto', ['companyId', 'monto'])
@Index('ix_movimientos_company_id_referencia', ['companyId', 'referencia'])
// Huella de contenido (FR-65): NO única, dos cargos idénticos son legítimos.
@Index('ix_movimientos_company_id_huella', ['companyId', 'huella'])
@Index('ix_movimientos_company_id_referencia_norm', [
  'companyId',
  'referenciaNorm',
])
@Check('ck_movimientos_estado', `estado IN (${listaSql(ESTADOS_MOVIMIENTO)})`)
@Check(
  'ck_movimientos_regla_sin_match',
  `regla_sin_match IS NULL OR regla_sin_match IN (${listaSql(REGLAS_SIN_MATCH)})`,
)
@Check(
  'ck_movimientos_sin_match_par',
  '(motivo_sin_match IS NULL) = (regla_sin_match IS NULL)',
)
@Check('ck_movimientos_monto_no_cero', 'monto <> 0')
@Check('ck_movimientos_linea_numero', 'linea_numero >= 0')
export class Movimiento extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  cargaId: string | null;

  /**
   * Línea física del archivo donde empieza la fila, con el encabezado en la
   * 1 (CU-09): el contador la encuentra al abrir el CSV. Así la primera fila
   * de datos es la 2.
   */
  @Column({ type: 'integer' })
  lineaNumero: number;

  /** El banco da el día, no la hora. */
  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  referencia: string | null;

  /**
   * CU-11: la referencia normalizada (mayúsculas, sin signos, sin ceros a la
   * izquierda del primer bloque de dígitos). La calcula la base con
   * `normalizar_referencia`; nunca se escribe desde la app.
   */
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    asExpression: 'normalizar_referencia(referencia)',
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  referenciaNorm: string | null;

  /**
   * Con signo: positivo es abono (entra dinero), negativo es cargo. Un solo
   * campo evita que `tipo` y `monto` puedan contradecirse.
   */
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  monto: string;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  moneda: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  banco: string | null;

  /**
   * Cuenta tal como llegó en la carga (`cargas.cuenta`). El cliente pide solo
   * los últimos dígitos, pero el servidor no la enmascara ni la valida.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  cuenta: string | null;

  /**
   * Huella versionada (`huellaMovimiento`, src/bancos/huella-movimiento.ts)
   * para detectar el mismo movimiento en dos archivos. NULL solo en filas que
   * aún no la tienen; la migración HuellaMovimientos rellenó las existentes.
   */
  @Column({ type: 'varchar', length: 70, nullable: true })
  huella: string | null;

  /**
   * 'pendiente_revision': dudoso por huella repetida con otra referencia
   * cruda; fuera de la conciliación y de la bandeja hasta que se resuelva.
   */
  @Column({ type: 'varchar', length: 32, default: 'abierto' })
  estado: EstadoMovimiento;

  /**
   * CU-13: por qué este movimiento abierto no recibió propuesta. Las tres
   * columnas van juntas: NULL con propuesta vigente o sin evaluar. Las escribe
   * `conciliar`; nunca la carga de estados de cuenta.
   */
  @Column({ type: 'text', nullable: true })
  motivoSinMatch: string | null;

  /** Código estable de `REGLAS_SIN_MATCH`; contrato para la bandeja (CU-14). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  reglaSinMatch: ReglaSinMatch | null;

  /** Cuándo se fijó (o cambió) el resultado guardado; no la última corrida. */
  @Column({ type: 'timestamptz', nullable: true })
  evaluadoAt: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_movimientos_company',
  })
  company: Company;

  @ManyToOne(() => Carga, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'carga_id',
    foreignKeyConstraintName: 'fk_movimientos_carga',
  })
  carga: Carga | null;
}
