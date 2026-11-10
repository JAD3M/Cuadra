import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { Decision } from './decision.entity';

/** Largo máximo de un comentario; el DTO y el CHECK usan el mismo número. */
export const COMENTARIO_MAXIMO = 1000;

/**
 * Observación de una persona sobre una decisión (FR-68, AD-4). Solo agregar:
 * `cuadra_app` tiene SELECT e INSERT, así que no se edita ni se borra, y no
 * cambia nada de la decisión.
 */
@Entity('decision_comentarios')
@Index('ix_decision_comentarios_company_id_decision_id', [
  'companyId',
  'decisionId',
])
@Check(
  'ck_decision_comentarios_texto',
  `length(btrim(texto)) > 0 AND length(texto) <= ${COMENTARIO_MAXIMO}`,
)
export class DecisionComentario extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  decisionId: string;

  @Column({ type: 'uuid' })
  autorId: string;

  @Column({ type: 'text' })
  texto: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_decision_comentarios_company',
  })
  company: Company;

  @ManyToOne(() => Decision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'decision_id',
    foreignKeyConstraintName: 'fk_decision_comentarios_decision',
  })
  decision: Decision;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'autor_id',
    foreignKeyConstraintName: 'fk_decision_comentarios_autor',
  })
  autor: User;
}
