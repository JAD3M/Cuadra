import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Decision } from '../conciliacion/decision.entity';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';

/**
 * Una decisión elegida en el sorteo mensual (AD-10, FR-63) y, desde la 9.4, las
 * marcas de su verificación. Solo agregar: `cuadra_app` tiene SELECT e INSERT,
 * así que la muestra no se reescribe ni se vuelve a sortear. La fila del sorteo
 * no tiene `resultado`; cada marca es una fila nueva con persona (`verificador_id`)
 * y fecha (`created_at`), y el estado de un caso es su última marca.
 */
@Entity('muestras_verificacion')
@Index(
  'ux_muestras_verificacion_empresa_mes_decision',
  ['companyId', 'mes', 'decisionId'],
  { unique: true, where: 'resultado IS NULL' },
)
@Check(
  'ck_muestras_verificacion_marca',
  `(resultado IS NULL AND verificador_id IS NULL) OR (resultado IS NOT NULL AND resultado IN ('conforme', 'desacuerdo') AND verificador_id IS NOT NULL)`,
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

  /** Quien marcó; nulo en la fila del sorteo. */
  @Column({ type: 'uuid', nullable: true })
  verificadorId: string | null;

  /** `conforme` | `desacuerdo`; nulo en la fila del sorteo. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  resultado: string | null;

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

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'verificador_id',
    foreignKeyConstraintName: 'fk_muestras_verificacion_verificador',
  })
  verificador: User | null;
}
