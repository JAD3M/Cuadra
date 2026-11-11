import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Decision } from '../conciliacion/decision.entity';
import { EntidadBase } from '../common/entities/base.entity';
import {
  EVENTOS_SOMBRA,
  listaSql,
  type EventoSombra,
} from '../common/entities/tipos';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';

/**
 * Una fila por evento del modo sombra (AD-10, FR-34). Solo agregar:
 * `cuadra_app` tiene SELECT e INSERT, así que la evidencia no se reescribe y
 * las tasas se calculan por consulta sobre estas filas.
 */
@Entity('evidencia_sombra')
@Index('ux_evidencia_sombra_habria_cerrado', ['decisionId'], {
  unique: true,
  where: `evento = 'habria_cerrado'`,
})
@Index('ix_evidencia_sombra_company_id_evento', ['companyId', 'evento'])
@Index('ix_evidencia_sombra_company_id_decision_id', [
  'companyId',
  'decisionId',
])
@Check('ck_evidencia_sombra_evento', `evento IN (${listaSql(EVENTOS_SOMBRA)})`)
export class EvidenciaSombra extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  banco: string | null;

  @Column({ type: 'uuid' })
  decisionId: string;

  @Column({ type: 'varchar', length: 32 })
  evento: EventoSombra;

  @Column({ type: 'uuid', nullable: true })
  personaId: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_evidencia_sombra_company',
  })
  company: Company;

  @ManyToOne(() => Decision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'decision_id',
    foreignKeyConstraintName: 'fk_evidencia_sombra_decision',
  })
  decision: Decision;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'persona_id',
    foreignKeyConstraintName: 'fk_evidencia_sombra_persona',
  })
  persona: User | null;
}
