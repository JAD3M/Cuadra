// src/plataforma/plataforma-usuario.entity.ts
import { Check, Column, Entity, Index } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';

/**
 * Historia 1.3 (AD-2, clase 3). Cuenta del dueño de Cuadra: no pertenece a
 * ninguna empresa, no tiene `company_id` ni RLS. Solo el módulo `plataforma/`
 * (y su siembra) puede nombrar esta entidad. Una cuenta se desactiva, no se
 * borra: `cuadra_app` no tiene DELETE.
 */
@Entity('plataforma_usuarios')
@Index('ux_plataforma_usuarios_correo', ['correo'], { unique: true })
@Check(
  'ck_plataforma_usuarios_correo_normalizado',
  'correo = lower(btrim(correo))',
)
export class PlataformaUsuario extends EntidadBase {
  /** Siempre normalizado (minúsculas, sin espacios en los extremos). */
  @Column({ type: 'varchar', length: 320 })
  correo: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
