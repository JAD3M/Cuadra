// src/auth/sesion.entity.ts
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
import { Company } from '../companies/company.entity';
import { listaSql } from '../common/entities/tipos';
import { User } from '../users/user.entity';

export const TIPOS_SESION = ['empresa', 'plataforma'] as const;
export type TipoSesion = (typeof TIPOS_SESION)[number];

/**
 * Historia 1.1 (AD-2, AD-6). Una fila por sesión abierta; la cookie lleva el
 * token y aquí solo vive su huella, nunca el token. Es identidad, no dominio:
 * clase 2, sin RLS, y el guard la lee fuera de la transacción de empresa.
 * `company_id` es nulo hasta que la persona elige empresa, y para el tipo
 * `plataforma`. Es la única tabla con DELETE para `cuadra_app`: cerrar sesión
 * borra la fila. No hereda de EntidadBase: no tiene `updated_at`, la actividad
 * se lleva en `ultima_actividad`.
 */
@Entity('sesiones')
@Index('ux_sesiones_token_hash', ['tokenHash'], { unique: true })
@Index('ix_sesiones_user_id', ['userId'])
@Index('ix_sesiones_expira_en', ['expiraEn'])
@Check('ck_sesiones_tipo', `tipo IN (${listaSql(TIPOS_SESION)})`)
export class Sesion {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** SHA-256 en hex del token de la cookie. */
  @Column({ type: 'text' })
  tokenHash: string;

  @Column({ type: 'varchar', length: 16 })
  tipo: TipoSesion;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'timestamptz' })
  ultimaActividad: Date;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  creadaEn: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_sesiones_user' })
  user: User;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_sesiones_company',
  })
  company: Company | null;
}
