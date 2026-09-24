// src/companies/company.entity.ts
import { Column, Entity, Index } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';

/** Raíz del aislamiento multiempresa: no lleva `company_id`, lo es. */
@Entity('companies')
@Index('ux_companies_rfc', ['rfc'], { unique: true })
export class Company extends EntidadBase {
  @Column({ type: 'varchar', length: 13 })
  rfc: string;

  @Column({ type: 'varchar', length: 255 })
  razonSocial: string;

  /** Clave del catálogo c_RegimenFiscal del SAT (tres dígitos). */
  @Column({ type: 'varchar', length: 3, nullable: true })
  regimenFiscal: string | null;

  @Column({ type: 'boolean', default: true })
  activa: boolean;
}
