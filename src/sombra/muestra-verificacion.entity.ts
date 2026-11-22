import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Decision } from '../conciliacion/decision.entity';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';

/**
 * Una decisión elegida en el sorteo mensual (AD-10, FR-63). Solo agregar:
 * `cuadra_app` tiene SELECT e INSERT, así que la muestra no se reescribe ni se
 * vuelve a sortear.
 */
@Entity('muestras_verificacion')
@Index(
  'ux_muestras_verificacion_empresa_mes_decision',
  ['companyId', 'mes', 'decisionId'],
  { unique: true },
)
@Index('ix_muestras_verificacion_company_id_decision_id', [
  'companyId',
  'decisionId',
])
export class MuestraVerificacion extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  /** Primer día del mes sorteado, como `YYYY-MM-DD` (UTC). */
  @Column({ type: 'date' })
  mes: string;

  @Column({ type: 'uuid' })
  decisionId: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_muestras_verificacion_company',
  })
  company: Company;

  @ManyToOne(() => Decision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'decision_id',
    foreignKeyConstraintName: 'fk_muestras_verificacion_decision',
  })
  decision: Decision;
}
