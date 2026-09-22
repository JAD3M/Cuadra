// src/database/entities/user.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { EntidadBase } from './base.entity';

/**
 * Los usuarios son globales, no de una empresa: la pertenencia y el rol
 * viven en `user_company_roles`, de modo que un contador externo puede
 * atender varias empresas con una sola credencial.
 */
@Entity('users')
@Index('ux_users_email', ['email'], { unique: true })
export class User extends EntidadBase {
  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
