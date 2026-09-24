// src/conciliacion/conciliacion.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Cfdi } from '../cfdi/cfdi.entity';
import { Company } from '../companies/company.entity';
import { Movimiento } from '../bancos/movimiento.entity';
import { User } from '../users/user.entity';
import {
  ESTADOS_CONCILIACION,
  listaSql,
  ORIGENES_CONCILIACION,
  type EstadoConciliacion,
  type OrigenConciliacion,
} from '../common/entities/tipos';

/** El cruce entre un CFDI y un movimiento bancario. */
@Entity('conciliaciones')
// Un CFDI y un movimiento se cierran una sola vez. Los índices parciales
// dejan convivir varias propuestas con, a lo más, una confirmada: es la
// traducción a esquema de "un falso positivo es peor que no conciliar".
@Index('ux_conciliaciones_cfdi_confirmada', ['companyId', 'cfdiId'], {
  unique: true,
  where: `estado = 'confirmada'`,
})
@Index(
  'ux_conciliaciones_movimiento_confirmada',
  ['companyId', 'movimientoId'],
  {
    unique: true,
    where: `estado = 'confirmada'`,
  },
)
@Index('ux_conciliaciones_par', ['companyId', 'cfdiId', 'movimientoId'], {
  unique: true,
})
@Index('ix_conciliaciones_company_id_estado', ['companyId', 'estado'])
@Check(
  'ck_conciliaciones_estado',
  `estado IN (${listaSql(ESTADOS_CONCILIACION)})`,
)
@Check(
  'ck_conciliaciones_origen',
  `origen IN (${listaSql(ORIGENES_CONCILIACION)})`,
)
@Check(
  'ck_conciliaciones_score_rango',
  'score IS NULL OR (score >= 0 AND score <= 1)',
)
// El motor de reglas y el LLM solo producen propuestas: para que una fila
// llegue a 'confirmada' tiene que constar quién la confirmó y cuándo.
@Check(
  'ck_conciliaciones_confirmada_requiere_persona',
  `estado <> 'confirmada' OR (confirmada_por_id IS NOT NULL AND confirmada_at IS NOT NULL)`,
)
export class Conciliacion extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  cfdiId: string;

  @Column({ type: 'uuid' })
  movimientoId: string;

  @Column({ type: 'varchar', length: 32, default: 'propuesta' })
  estado: EstadoConciliacion;

  @Column({ type: 'varchar', length: 32 })
  origen: OrigenConciliacion;

  /** Identificador de la regla que disparó la propuesta, si hubo una. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  regla: string | null;

  /** Confianza en [0,1]. Sugerencia, nunca autorización. */
  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  score: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  diferenciaMonto: string | null;

  /** Explicación legible: por qué se propuso, o por qué se rechazó. */
  @Column({ type: 'text', nullable: true })
  motivo: string | null;

  @Column({ type: 'uuid', nullable: true })
  confirmadaPorId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmadaAt: Date | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_conciliaciones_company',
  })
  company: Company;

  @ManyToOne(() => Cfdi, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'cfdi_id',
    foreignKeyConstraintName: 'fk_conciliaciones_cfdi',
  })
  cfdi: Cfdi;

  @ManyToOne(() => Movimiento, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'movimiento_id',
    foreignKeyConstraintName: 'fk_conciliaciones_movimiento',
  })
  movimiento: Movimiento;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'confirmada_por_id',
    foreignKeyConstraintName: 'fk_conciliaciones_confirmada_por',
  })
  confirmadaPor: User | null;
}
