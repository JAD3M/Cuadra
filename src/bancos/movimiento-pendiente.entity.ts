// src/bancos/movimiento-pendiente.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from '../common/entities/base.entity';
import { Carga } from '../cargas/carga.entity';
import { Company } from '../companies/company.entity';

/**
 * Zona de espera (historia 3.3): una línea leída de un PDF cuyos saldos
 * cuadran, todavía fuera de `movimientos`. La vista previa (3.4) la pasa a
 * `movimientos`. Mismas columnas de dato que `Movimiento`, sin estado ni
 * resultado de conciliación: aún no se concilia.
 */
@Entity('movimientos_pendientes')
@Index(
  'ux_movimientos_pendientes_company_carga_linea',
  ['companyId', 'cargaId', 'lineaNumero'],
  { unique: true },
)
@Check('ck_movimientos_pendientes_monto_no_cero', 'monto <> 0')
@Check('ck_movimientos_pendientes_linea_numero', 'linea_numero >= 0')
export class MovimientoPendiente extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  cargaId: string;

  @Column({ type: 'integer' })
  lineaNumero: number;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  referencia: string | null;

  /** Con signo: positivo es abono, negativo es cargo. NUMERIC, nunca flotante. */
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  monto: string;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  moneda: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  banco: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cuenta: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_movimientos_pendientes_company',
  })
  company: Company;

  @ManyToOne(() => Carga, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'carga_id',
    foreignKeyConstraintName: 'fk_movimientos_pendientes_carga',
  })
  carga: Carga;
}
