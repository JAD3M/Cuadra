import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { Movimiento } from '../bancos/movimiento.entity';
import { User } from '../users/user.entity';
import {
  ESTADOS_DECISION,
  listaSql,
  ORIGENES_CONCILIACION,
  TIPOS_DECISION,
  type EstadoDecision,
  type OrigenConciliacion,
  type TipoDecision,
} from '../common/entities/tipos';

/**
 * Cabecera de una decisión sobre un movimiento (AD-4): una conciliación con
 * una o varias facturas, o un descarte. La historia 4.1 creó la tabla y la 4.2
 * pasó el código a usarla; `conciliaciones` queda solo como historial hasta
 * que la 4.3 la retire.
 */
@Entity('decisiones')
// Destino de la FK compuesta de `decision_lineas`.
@Index('ux_decisiones_id_estado', ['id', 'estado'], { unique: true })
// Una decisión vigente por movimiento, sin triggers.
@Index(
  'ux_decisiones_company_movimiento_vigente',
  ['companyId', 'movimientoId'],
  { unique: true, where: 'vigente' },
)
// Un conjunto propuesto o rechazado no se vuelve a proponer.
@Index(
  'ux_decisiones_movimiento_huella_abierta',
  ['movimientoId', 'huellaConjunto'],
  {
    unique: true,
    where: `estado IN ('propuesta', 'rechazada')`,
  },
)
@Index('ix_decisiones_company_id_estado', ['companyId', 'estado'])
@Check('ck_decisiones_estado', `estado IN (${listaSql(ESTADOS_DECISION)})`)
@Check('ck_decisiones_tipo', `tipo IN (${listaSql(TIPOS_DECISION)})`)
@Check('ck_decisiones_origen', `origen IN (${listaSql(ORIGENES_CONCILIACION)})`)
@Check(
  'ck_decisiones_score_rango',
  'score IS NULL OR (score >= 0 AND score <= 1)',
)
// AD-3: nada se confirma sin una persona.
@Check(
  'ck_decisiones_confirmada_requiere_persona',
  `estado <> 'confirmada' OR (confirmada_por_id IS NOT NULL AND confirmada_at IS NOT NULL)`,
)
// AD-4: un descarte lleva motivo y solo vive como descartada o reabierta.
@Check(
  'ck_decisiones_descarte_coherente',
  `tipo <> 'descarte' OR (motivo IS NOT NULL AND estado IN ('descartada', 'reabierta'))`,
)
// Historia 5.6: un descarte siempre dice quién lo hizo y cuándo.
@Check(
  'ck_decisiones_descarte_persona',
  `tipo <> 'descarte' OR (descartada_por_id IS NOT NULL AND descartada_at IS NOT NULL)`,
)
export class Decision extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  movimientoId: string;

  @Column({ type: 'varchar', length: 32 })
  tipo: TipoDecision;

  @Column({ type: 'varchar', length: 32, default: 'propuesta' })
  estado: EstadoDecision;

  @Column({ type: 'varchar', length: 32 })
  origen: OrigenConciliacion;

  @Column({ type: 'varchar', length: 64, nullable: true })
  regla: string | null;

  /** Confianza en [0,1]. Sugerencia, nunca autorización. */
  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  score: string | null;

  /** Diferencia de monto del grupo completo. */
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  diferenciaMonto: string | null;

  @Column({ type: 'uuid', nullable: true })
  confirmadaPorId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmadaAt: Date | null;

  /** Historia 5.6: quién descartó el movimiento (solo en tipo 'descarte'). */
  @Column({ type: 'uuid', nullable: true })
  descartadaPorId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  descartadaAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  loteId: string | null;

  @Column({ type: 'text', nullable: true })
  motivo: string | null;

  @Column({ type: 'boolean', default: false })
  requiereRevision: boolean;

  /** Huella del conjunto de facturas (función SQL en la historia 4.1/T3). */
  @Column({ type: 'varchar' })
  huellaConjunto: string;

  /** La calcula la base: confirmada y descartada son las que ocupan el caso. */
  @Column({
    type: 'boolean',
    asExpression: `estado IN ('confirmada', 'descartada')`,
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  vigente: boolean;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_decisiones_company',
  })
  company: Company;

  @ManyToOne(() => Movimiento, { onDelete: 'CASCADE' })
  @JoinColumn([
    {
      name: 'company_id',
      referencedColumnName: 'companyId',
      foreignKeyConstraintName: 'fk_decisiones_movimiento',
    },
    { name: 'movimiento_id', referencedColumnName: 'id' },
  ])
  movimiento: Movimiento;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'confirmada_por_id',
    foreignKeyConstraintName: 'fk_decisiones_confirmada_por',
  })
  confirmadaPor: User | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'descartada_por_id',
    foreignKeyConstraintName: 'fk_decisiones_descartada_por',
  })
  descartadaPor: User | null;
}
