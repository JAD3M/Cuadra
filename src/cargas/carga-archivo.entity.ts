// src/cargas/carga-archivo.entity.ts
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Company } from '../companies/company.entity';
import { Carga } from './carga.entity';

/**
 * Un archivo de un lote en espera de procesarse (CU-08). Vive en Postgres y
 * no en el job de Redis: Redis no tiene persistencia, y un job con los
 * archivos adentro se perdería con un reinicio, dejando la carga en
 * 'pendiente' para siempre y sin error. El job solo lleva {cargaId,
 * companyId}.
 */
@Entity('carga_archivos')
@Index('ux_carga_archivos_carga_orden', ['cargaId', 'orden'], { unique: true })
@Index('ix_carga_archivos_company_id_carga_id', ['companyId', 'cargaId'])
export class CargaArchivo extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  cargaId: string;

  /** Posición en la petición, desde 0: los resultados salen en este orden. */
  @Column({ type: 'integer' })
  orden: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  /** SHA-256 del archivo, en hexadecimal. */
  @Column({ type: 'char', length: 64 })
  hash: string;

  /**
   * El XML como texto UTF-8. NULL si el archivo trae bytes nulos: Postgres
   * no los admite en `text`, y un XML con NUL no es XML válido. El worker lo
   * reporta como error del archivo.
   */
  @Column({ type: 'text', nullable: true })
  contenido: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_carga_archivos_company',
  })
  company: Company;

  @ManyToOne(() => Carga, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'carga_id',
    foreignKeyConstraintName: 'fk_carga_archivos_carga',
  })
  carga: Carga;
}
