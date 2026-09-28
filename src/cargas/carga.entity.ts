// src/cargas/carga.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import {
  ESTADOS_CARGA,
  listaSql,
  TIPOS_CARGA,
  type EstadoCarga,
  type TipoCarga,
} from '../common/entities/tipos';

export interface ErrorDeArchivo {
  archivo: string;
  motivo: string;
}

/**
 * Una petición de carga: un lote de CFDI (uno o varios archivos) o un estado
 * de cuenta bancario.
 */
@Entity('cargas')
@Index('ix_cargas_company_id_created_at', ['companyId', 'createdAt'])
@Index('ux_cargas_company_id_hash_archivo', ['companyId', 'hashArchivo'], {
  unique: true,
})
@Check('ck_cargas_tipo', `tipo IN (${listaSql(TIPOS_CARGA)})`)
@Check('ck_cargas_estado', `estado IN (${listaSql(ESTADOS_CARGA)})`)
@Check(
  'ck_cargas_conteos_no_negativos',
  'total_registros >= 0 AND registros_ok >= 0 AND registros_error >= 0',
)
export class Carga extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'varchar', length: 32 })
  tipo: TipoCarga;

  @Column({ type: 'varchar', length: 32, default: 'pendiente' })
  estado: EstadoCarga;

  @Column({ type: 'varchar', length: 512 })
  nombreArchivo: string;

  /**
   * SHA-256 en hexadecimal; hace idempotente volver a subir lo mismo. En un
   * lote de CFDI es el SHA-256 de los hashes de cada archivo, ordenados: el
   * mismo lote da el mismo hash sin importar el orden.
   */
  @Column({ type: 'char', length: 64 })
  hashArchivo: string;

  @Column({ type: 'integer', default: 0 })
  totalRegistros: number;

  @Column({ type: 'integer', default: 0 })
  registrosOk: number;

  @Column({ type: 'integer', default: 0 })
  registrosError: number;

  @Column({ type: 'text', nullable: true })
  errorMensaje: string | null;

  /** Un elemento por archivo que no entró (CU-06). Vacío si todos entraron. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  errores: ErrorDeArchivo[];

  @Column({ type: 'timestamptz', nullable: true })
  procesadaAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  subidoPorId: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_cargas_company',
  })
  company: Company;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'subido_por_id',
    foreignKeyConstraintName: 'fk_cargas_subido_por',
  })
  subidoPor: User | null;
}
