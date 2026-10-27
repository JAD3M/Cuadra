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

/**
 * Historia 3.1: solo en el CFDI cuya moneda no es MXN ni XXX. Se acepta, pero
 * queda marcado «moneda no soportada». No hay columna: se deriva al leer.
 */
export type MarcaDeMoneda =
  | { monedaNoSoportada: true; moneda: string }
  | { monedaNoSoportada?: undefined; moneda?: undefined };

/**
 * Qué pasó con cada archivo del lote (CU-06, CU-07). `motivo` solo en
 * 'error'.
 */
export type ResultadoDeArchivo =
  | ({ archivo: string; resultado: 'nuevo' | 'ya_existia' } & MarcaDeMoneda)
  | { archivo: string; resultado: 'error'; motivo: string };

/**
 * Estado de cuenta (CU-09): solo las filas que no entraron. `fila` es la
 * línea física del archivo (encabezado = 1), la que ve el contador al
 * abrirlo. Las que entraron no se listan: un estado de cuenta trae miles.
 */
export interface ResultadoDeFila {
  fila: number;
  resultado: 'error';
  motivo: string;
}

export type ResultadoDeCarga = ResultadoDeArchivo | ResultadoDeFila;

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
  'total_registros >= 0 AND registros_ok >= 0 AND registros_error >= 0 AND registros_existentes >= 0',
)
// Cada archivo cae en exactamente un contador (CU-07). Mientras la carga no
// termina, o si terminó por falla de infraestructura, los contadores solo
// pueden ir por debajo del total (CU-08).
@Check(
  'ck_cargas_total_cuadra',
  `(estado IN ('procesada', 'con_errores') AND total_registros = registros_ok + registros_error + registros_existentes) OR (estado NOT IN ('procesada', 'con_errores') AND registros_ok + registros_error + registros_existentes <= total_registros)`,
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

  /** CFDI cuyo UUID ya estaba en la empresa: no es error ni se duplica (CU-07). */
  @Column({ type: 'integer', default: 0 })
  registrosExistentes: number;

  @Column({ type: 'text', nullable: true })
  errorMensaje: string | null;

  /**
   * CFDI: un elemento por archivo del lote, en el orden en que llegaron.
   * Estado de cuenta: una por fila que no entró.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  resultados: ResultadoDeCarga[];

  /** Estado de cuenta (CU-09): se copian a cada movimiento. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  banco: string | null;

  /**
   * Cuenta tal como llegó, igual que en `movimientos.cuenta`. El cliente pide
   * solo los últimos dígitos, pero el servidor no la enmascara ni la valida.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  cuenta: string | null;

  /**
   * Estado de cuenta (CU-10): el perfil de banco con el que se leyó. NULL en
   * los CFDI.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  perfil: string | null;

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
