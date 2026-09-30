// src/sugerencias/sugerencia-ia.entity.ts
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Movimiento } from '../bancos/movimiento.entity';
import { Company } from '../companies/company.entity';
import {
  listaSql,
  RESULTADOS_SUGERENCIA,
  type ResultadoSugerencia,
} from '../common/entities/tipos';

/**
 * CU-17. Libro de lo que ya se le preguntó al modelo: una fila por
 * (movimiento, huella de la entrada). Sirve para no pagar dos veces por la
 * misma pregunta. Es de solo agregar (INSERT sin UPDATE/DELETE para
 * `cuadra_app`), así que no hereda de EntidadBase ni tiene `updated_at`.
 * No guarda montos ni texto del banco: solo la huella y el resultado.
 */
@Entity('sugerencias_ia')
@Index(
  'ux_sugerencias_ia_movimiento_hash',
  ['companyId', 'movimientoId', 'inputHash'],
  { unique: true },
)
@Check(
  'ck_sugerencias_ia_resultado',
  `resultado IN (${listaSql(RESULTADOS_SUGERENCIA)})`,
)
export class SugerenciaIa {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  movimientoId: string;

  /** sha256 en hex de la entrada canónica enviada al modelo. */
  @Column({ type: 'char', length: 64 })
  inputHash: string;

  @Column({ type: 'varchar', length: 32 })
  resultado: ResultadoSugerencia;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_sugerencias_ia_company',
  })
  company: Company;

  // FK compuesta: el movimiento tiene que ser de la misma empresa.
  @ManyToOne(() => Movimiento, { onDelete: 'CASCADE' })
  @JoinColumn([
    {
      name: 'company_id',
      referencedColumnName: 'companyId',
      foreignKeyConstraintName: 'fk_sugerencias_ia_movimiento',
    },
    { name: 'movimiento_id', referencedColumnName: 'id' },
  ])
  movimiento: Movimiento;
}
