// src/companies/company.entity.ts
import { Check, Column, Entity, Index } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';

/** Raíz del aislamiento multiempresa: no lleva `company_id`, lo es. */
@Entity('companies')
@Index('ux_companies_rfc', ['rfc'], { unique: true })
@Check(
  'ck_companies_tolerancia_monto_rango',
  'tolerancia_monto >= 0 AND tolerancia_monto <= 100',
)
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

  /**
   * CU-12. Tolerancia de monto del motor de reglas, en MXN absolutos. Texto:
   * NUMERIC nunca pasa por `number`. Estricta (0) por omisión.
   */
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  toleranciaMonto: string;
}
