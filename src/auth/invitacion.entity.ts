// src/auth/invitacion.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { listaSql, ROLES, type Rol } from '../common/entities/tipos';

/**
 * Historia 1.5 (FR-40, AD-14). Invitación de un solo uso a una empresa. Es
 * identidad, no dominio: clase 2, sin RLS, porque se consulta con el enlace
 * antes de que exista sesión. Solo guarda el SHA-256 del token, nunca el
 * token. Estados: viva (ambas marcas nulas), consumida o reemplazada; la
 * caducidad se deriva de `expiresAt`. Solo hay una viva por (empresa, correo).
 */
@Entity('invitaciones')
@Index('ux_invitaciones_token_hash', ['tokenHash'], { unique: true })
@Index('ux_invitaciones_viva', ['companyId', 'email'], {
  unique: true,
  where: `consumida_en IS NULL AND reemplazada_en IS NULL`,
})
@Check(
  'ck_invitaciones_roles',
  `cardinality(roles) >= 1 AND roles <@ ARRAY[${listaSql(ROLES)}]::text[]`,
)
@Check(
  'ck_invitaciones_invitador',
  `(invitada_por_plataforma_usuario_id IS NULL) <> (invitada_por_user_id IS NULL)`,
)
export class Invitacion extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  /** Siempre normalizado con `normalizarEmail` (src/auth/email.ts). */
  @Column({ type: 'varchar', length: 320 })
  email: string;

  /** Uno o más roles que recibe quien acepta (historia 2.3); la plataforma invita con ['admin']. */
  @Column({ type: 'text', array: true })
  roles: Rol[];

  /** SHA-256 en hex del token del enlace. */
  @Column({ type: 'text' })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumidaEn: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reemplazadaEn: Date | null;

  /**
   * Cuenta de plataforma que invitó (clase 3); la relación va por nombre.
   * Exactamente uno de este y `invitadaPorUserId` está presente.
   */
  @Column({ type: 'uuid', nullable: true })
  invitadaPorPlataformaUsuarioId: string | null;

  /** Persona de la empresa que invitó (historia 2.3). */
  @Column({ type: 'uuid', nullable: true })
  invitadaPorUserId: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_invitaciones_company',
  })
  company: Company;

  @ManyToOne('PlataformaUsuario', { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'invitada_por_plataforma_usuario_id',
    foreignKeyConstraintName: 'fk_invitaciones_plataforma_usuario',
  })
  invitadaPor: unknown;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'invitada_por_user_id',
    foreignKeyConstraintName: 'fk_invitaciones_invitada_por_user',
  })
  invitadaPorUsuario: User | null;
}
