// src/database/entities/movimiento.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from './base.entity';
import { Carga } from './carga.entity';
import { Company } from './company.entity';
import { ESTADOS_MOVIMIENTO, listaSql, type EstadoMovimiento } from './tipos';

/** Una línea del estado de cuenta bancario. */
@Entity('movimientos')
// Idempotencia al reprocesar un archivo: la misma línea del mismo estado de
// cuenta no entra dos veces. Se identifica por posición, no por contenido,
// porque dos cargos legítimos pueden ser idénticos el mismo día.
@Index(
  'ux_movimientos_company_carga_linea',
  ['companyId', 'cargaId', 'lineaNumero'],
  {
    unique: true,
  },
)
@Index('ix_movimientos_company_id_fecha_abierto', ['companyId', 'fecha'], {
  where: `estado = 'abierto'`,
})
@Index('ix_movimientos_company_id_monto', ['companyId', 'monto'])
@Index('ix_movimientos_company_id_referencia', ['companyId', 'referencia'])
@Check('ck_movimientos_estado', `estado IN (${listaSql(ESTADOS_MOVIMIENTO)})`)
@Check('ck_movimientos_monto_no_cero', 'monto <> 0')
@Check('ck_movimientos_linea_numero', 'linea_numero >= 0')
export class Movimiento extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  cargaId: string | null;

  /** Posición de la línea dentro del archivo, base 0. */
  @Column({ type: 'integer' })
  lineaNumero: number;

  /** El banco da el día, no la hora. */
  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  referencia: string | null;

  /**
   * Con signo: positivo es abono (entra dinero), negativo es cargo. Un solo
   * campo evita que `tipo` y `monto` puedan contradecirse.
   */
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  monto: string;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  moneda: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  banco: string | null;

  /** Cuenta enmascarada: solo los últimos dígitos, nunca la CLABE completa. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  cuenta: string | null;

  @Column({ type: 'varchar', length: 32, default: 'abierto' })
  estado: EstadoMovimiento;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_movimientos_company',
  })
  company: Company;

  @ManyToOne(() => Carga, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'carga_id',
    foreignKeyConstraintName: 'fk_movimientos_carga',
  })
  carga: Carga | null;
}
