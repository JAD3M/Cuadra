import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Cfdi } from '../cfdi/cfdi.entity';
import { Company } from '../companies/company.entity';
import type { EstadoDecision } from '../common/entities/tipos';
import { Decision } from './decision.entity';

/**
 * Una factura dentro de una decisión (AD-4). `estadoDecision` copia el estado
 * de la cabecera por FK compuesta con ON UPDATE CASCADE, para que el índice
 * único parcial de `vigente` no necesite triggers.
 */
@Entity('decision_lineas')
@Index('ux_decision_lineas_company_cfdi_vigente', ['companyId', 'cfdiId'], {
  unique: true,
  where: 'vigente',
})
@Index('ix_decision_lineas_company_id_decision_id', ['companyId', 'decisionId'])
export class DecisionLinea extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  decisionId: string;

  @Column({ type: 'varchar', length: 32 })
  estadoDecision: EstadoDecision;

  @Column({ type: 'uuid' })
  cfdiId: string;

  @Column({
    type: 'boolean',
    asExpression: `estado_decision IN ('confirmada', 'descartada')`,
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  vigente: boolean;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_decision_lineas_company',
  })
  company: Company;

  @ManyToOne(() => Decision, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([
    {
      name: 'decision_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_decision_lineas_decision',
    },
    { name: 'estado_decision', referencedColumnName: 'estado' },
  ])
  decision: Decision;

  @ManyToOne(() => Cfdi, { onDelete: 'CASCADE' })
  @JoinColumn([
    {
      name: 'company_id',
      referencedColumnName: 'companyId',
      foreignKeyConstraintName: 'fk_decision_lineas_cfdi',
    },
    { name: 'cfdi_id', referencedColumnName: 'id' },
  ])
  cfdi: Cfdi;
}
