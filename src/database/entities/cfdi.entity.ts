// src/database/entities/cfdi.entity.ts
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EntidadBase } from './base.entity';
import { Carga } from './carga.entity';
import { Company } from './company.entity';
import {
  ESTADOS_CFDI,
  listaSql,
  TIPOS_COMPROBANTE,
  type EstadoCfdi,
  type TipoComprobante,
} from './tipos';

@Entity('cfdi')
// El folio fiscal es único a nivel SAT, pero lo acotamos por empresa: dos
// empresas del mismo grupo pueden recibir el mismo CFDI y cada una lo concilia.
@Index('ux_cfdi_company_id_uuid_fiscal', ['companyId', 'uuidFiscal'], {
  unique: true,
})
// Índice parcial: el motor de reglas solo busca candidatos entre las abiertas,
// que son una fracción del histórico.
@Index('ix_cfdi_company_id_rfc_emisor_abierta', ['companyId', 'rfcEmisor'], {
  where: `estado = 'abierta'`,
})
@Index('ix_cfdi_company_id_fecha_emision', ['companyId', 'fechaEmision'])
@Index('ix_cfdi_company_id_total', ['companyId', 'total'])
@Index('ix_cfdi_carga_id', ['cargaId'])
@Check('ck_cfdi_estado', `estado IN (${listaSql(ESTADOS_CFDI)})`)
@Check(
  'ck_cfdi_tipo_comprobante',
  `tipo_comprobante IN (${listaSql(TIPOS_COMPROBANTE)})`,
)
@Check(
  'ck_cfdi_total_no_negativo',
  'total >= 0 AND subtotal >= 0 AND descuento >= 0',
)
// "El XML original íntegro": xml_raw guarda el árbol parseado y, bajo la clave
// reservada `_xml`, la cadena tal como llegó del SAT, byte por byte. El CHECK
// impide que se inserte un CFDI sin ese original.
@Check(
  'ck_cfdi_xml_raw_integro',
  `jsonb_typeof(xml_raw) = 'object' AND xml_raw ? '_xml'`,
)
export class Cfdi extends EntidadBase {
  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  cargaId: string | null;

  /** Folio fiscal del SAT (UUID canónico de 36 caracteres). */
  @Column({ type: 'varchar', length: 36 })
  uuidFiscal: string;

  @Column({ type: 'varchar', length: 13 })
  rfcEmisor: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreEmisor: string | null;

  @Column({ type: 'varchar', length: 13 })
  rfcReceptor: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreReceptor: string | null;

  @Column({ type: 'varchar', length: 25, nullable: true })
  serie: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  folio: string | null;

  /**
   * El atributo `Fecha` del CFDI viene sin offset: es hora local del emisor.
   * Se guarda sin zona para no inventarle una.
   */
  @Column({ type: 'timestamp' })
  fechaEmision: Date;

  @Column({ type: 'varchar', length: 1 })
  tipoComprobante: TipoComprobante;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  moneda: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  tipoCambio: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  descuento: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  total: string;

  /** c_MetodoPago: PUE o PPD. */
  @Column({ type: 'varchar', length: 3, nullable: true })
  metodoPago: string | null;

  /** c_FormaPago: '01' efectivo, '03' transferencia, ... */
  @Column({ type: 'varchar', length: 2, nullable: true })
  formaPago: string | null;

  @Column({ type: 'varchar', length: 32, default: 'abierta' })
  estado: EstadoCfdi;

  @Column({ type: 'jsonb' })
  xmlRaw: Record<string, unknown>;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_cfdi_company',
  })
  company: Company;

  @ManyToOne(() => Carga, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'carga_id', foreignKeyConstraintName: 'fk_cfdi_carga' })
  carga: Carga | null;
}
