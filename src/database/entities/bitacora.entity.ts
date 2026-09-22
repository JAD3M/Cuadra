// src/database/entities/bitacora.entity.ts
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
import { Company } from './company.entity';
import { User } from './user.entity';
import { ACCIONES_BITACORA, listaSql, type AccionBitacora } from './tipos';

/**
 * Append-only: no hereda de EntidadBase porque una bitácora que se puede
 * actualizar no es una bitácora. Por eso no tiene `updated_at`.
 */
@Entity('bitacora')
@Index('ix_bitacora_company_id_created_at', ['companyId', 'createdAt'])
@Index('ix_bitacora_company_id_entidad', ['companyId', 'entidad', 'entidadId'])
@Check('ck_bitacora_accion', `accion IN (${listaSql(ACCIONES_BITACORA)})`)
export class Bitacora {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  /** Null cuando el actor es el motor de reglas y no una persona. */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Nombre de la tabla afectada: 'cfdi', 'conciliaciones', ... */
  @Column({ type: 'varchar', length: 64 })
  entidad: string;

  @Column({ type: 'uuid' })
  entidadId: string;

  @Column({ type: 'varchar', length: 32 })
  accion: AccionBitacora;

  /** Antes/después del cambio, o el contexto que produjo el evento. */
  @Column({ type: 'jsonb', nullable: true })
  datos: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_bitacora_company',
  })
  company: Company;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_bitacora_user' })
  user: User | null;
}
