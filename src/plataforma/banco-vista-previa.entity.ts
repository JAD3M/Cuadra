// src/plataforma/banco-vista-previa.entity.ts
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PlataformaUsuario } from './plataforma-usuario.entity';

/**
 * Historia 3.6 (AD-2, clase 3). Un renglón por banco cuya vista previa
 * obligatoria ya levantó el dueño. Global: sin `company_id` ni RLS. Solo
 * agrega: `cuadra_app` tiene SELECT e INSERT, nunca UPDATE ni DELETE. Solo el
 * módulo `plataforma/` nombra esta tabla; `cargas` pregunta al servicio.
 */
@Entity('bancos_vista_previa')
@Check(
  'ck_bancos_vista_previa_banco_normalizado',
  'banco = lower(btrim(banco))',
)
export class BancoVistaPrevia {
  /** Normalizado igual que `cargas.banco` (minúsculas, sin espacios). */
  @PrimaryColumn({
    type: 'varchar',
    length: 128,
    primaryKeyConstraintName: 'PK_bancos_vista_previa',
  })
  banco: string;

  @Column({ type: 'uuid' })
  levantadaPor: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  levantadaEn: Date;

  @ManyToOne(() => PlataformaUsuario, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'levantada_por',
    foreignKeyConstraintName: 'fk_bancos_vista_previa_usuario',
  })
  usuario: PlataformaUsuario;
}
