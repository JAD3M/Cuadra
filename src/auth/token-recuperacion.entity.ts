// src/auth/token-recuperacion.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

/**
 * Historia 1.6 (FR-43, AD-14). Enlace de un solo uso para restablecer la
 * contraseña. Es identidad, no dominio: clase 2, sin RLS, porque se consulta
 * con el enlace antes de que exista sesión. Solo guarda el SHA-256 del token.
 * Pertenece a una cuenta de empresa (`user_id`) o a la del dueño de la
 * plataforma (`plataforma_usuario_id`), exactamente una. Estados: viva (ambas
 * marcas nulas), consumida o reemplazada; la caducidad se deriva de
 * `expiresAt`. Solo hay una viva por cuenta.
 */
@Entity('tokens_recuperacion')
@Index('ux_tokens_recuperacion_token_hash', ['tokenHash'], { unique: true })
@Index('ux_tokens_recuperacion_viva_user', ['userId'], {
  unique: true,
  where: `consumida_en IS NULL AND reemplazada_en IS NULL`,
})
@Index('ux_tokens_recuperacion_viva_plataforma', ['plataformaUsuarioId'], {
  unique: true,
  where: `consumida_en IS NULL AND reemplazada_en IS NULL`,
})
@Check(
  'ck_tokens_recuperacion_una_cuenta',
  `(user_id IS NOT NULL AND plataforma_usuario_id IS NULL) OR (user_id IS NULL AND plataforma_usuario_id IS NOT NULL)`,
)
export class TokenRecuperacion extends EntidadBase {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Cuenta de plataforma (clase 3); la relación va por nombre. */
  @Column({ type: 'uuid', nullable: true })
  plataformaUsuarioId: string | null;

  /** SHA-256 en hex del token del enlace. */
  @Column({ type: 'text' })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumidaEn: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reemplazadaEn: Date | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_tokens_recuperacion_user',
  })
  user: User | null;

  @ManyToOne('PlataformaUsuario', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'plataforma_usuario_id',
    foreignKeyConstraintName: 'fk_tokens_recuperacion_plataforma_usuario',
  })
  plataformaUsuario: unknown;
}
