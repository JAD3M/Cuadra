// src/plataforma/bitacora-plataforma.entity.ts
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
import {
  ACCIONES_BITACORA_PLATAFORMA,
  type AccionBitacoraPlataforma,
  listaSql,
} from '../common/entities/tipos';
import { PlataformaUsuario } from './plataforma-usuario.entity';

/**
 * Historia 1.3 (AD-2, clase 3). Bitácora de solo agregar de la plataforma:
 * `cuadra_app` tiene SELECT e INSERT, nada más. `companyId` es informativo
 * (a qué empresa apuntaba el intento) y a propósito no tiene FK ni RLS: esta
 * tabla no es de dominio y nunca se filtra por empresa.
 */
@Entity('bitacora_plataforma')
@Index('ix_bitacora_plataforma_created_at', ['createdAt'])
@Check(
  'ck_bitacora_plataforma_accion',
  `accion IN (${listaSql(ACCIONES_BITACORA_PLATAFORMA)})`,
)
export class BitacoraPlataforma {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  /** Nulo cuando el evento no tiene una cuenta de plataforma autenticada. */
  @Column({ type: 'uuid', nullable: true })
  plataformaUsuarioId: string | null;

  @Column({ type: 'varchar', length: 64 })
  accion: AccionBitacoraPlataforma;

  @Column({ type: 'jsonb', nullable: true })
  detalle: Record<string, unknown> | null;

  /** Informativo: sin FK ni RLS. */
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => PlataformaUsuario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'plataforma_usuario_id',
    foreignKeyConstraintName: 'fk_bitacora_plataforma_usuario',
  })
  plataformaUsuario: PlataformaUsuario | null;
}
