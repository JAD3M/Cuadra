// src/companies/user-company-role.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from './company.entity';
import { User } from '../users/user.entity';
import { listaSql, ROLES, type Rol } from '../common/entities/tipos';

/**
 * Pertenencia de un usuario a una empresa, con su rol. La unicidad es sobre
 * la terna completa, así que alguien puede ser a la vez contador y revisor
 * en la misma empresa sin necesitar dos cuentas.
 */
@Entity('user_company_roles')
@Index(
  'ux_user_company_roles_user_company_rol',
  ['userId', 'companyId', 'rol'],
  {
    unique: true,
  },
)
@Index('ix_user_company_roles_company_id', ['companyId'])
@Check('ck_user_company_roles_rol', `rol IN (${listaSql(ROLES)})`)
export class UserCompanyRole extends EntidadBase {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'varchar', length: 32 })
  rol: Rol;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_user_company_roles_user',
  })
  user: User;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_user_company_roles_company',
  })
  company: Company;
}
