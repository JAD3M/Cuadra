import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1790110057425 implements MigrationInterface {
  name = 'EsquemaInicial1790110057425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "rfc" character varying(13) NOT NULL, "razon_social" character varying(255) NOT NULL, "regimen_fiscal" character varying(3), "activa" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_companies_rfc" ON "companies"  ("rfc") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(320) NOT NULL, "nombre" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_users_email" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_company_roles" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "company_id" uuid NOT NULL, "rol" character varying(32) NOT NULL, CONSTRAINT "ck_user_company_roles_rol" CHECK (rol IN ('admin', 'contador', 'revisor')), CONSTRAINT "PK_508675bf8cda811ec8ff812e337" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_user_company_roles_company_id" ON "user_company_roles"  ("company_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_user_company_roles_user_company_rol" ON "user_company_roles"  ("user_id", "company_id", "rol") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cargas" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "tipo" character varying(32) NOT NULL, "estado" character varying(32) NOT NULL DEFAULT 'pendiente', "nombre_archivo" character varying(512) NOT NULL, "hash_archivo" character(64) NOT NULL, "total_registros" integer NOT NULL DEFAULT '0', "registros_ok" integer NOT NULL DEFAULT '0', "registros_error" integer NOT NULL DEFAULT '0', "error_mensaje" text, "procesada_at" TIMESTAMP WITH TIME ZONE, "subido_por_id" uuid, CONSTRAINT "ck_cargas_conteos_no_negativos" CHECK (total_registros >= 0 AND registros_ok >= 0 AND registros_error >= 0), CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'fallida')), CONSTRAINT "ck_cargas_tipo" CHECK (tipo IN ('cfdi', 'estado_cuenta')), CONSTRAINT "PK_4c13a12b53e77eac1b416602abf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_cargas_company_id_hash_archivo" ON "cargas"  ("company_id", "hash_archivo") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_cargas_company_id_created_at" ON "cargas"  ("company_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cfdi" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "carga_id" uuid, "uuid_fiscal" character varying(36) NOT NULL, "rfc_emisor" character varying(13) NOT NULL, "nombre_emisor" character varying(255), "rfc_receptor" character varying(13) NOT NULL, "nombre_receptor" character varying(255), "serie" character varying(25), "folio" character varying(40), "fecha_emision" TIMESTAMP NOT NULL, "tipo_comprobante" character varying(1) NOT NULL, "moneda" character(3) NOT NULL DEFAULT 'MXN', "tipo_cambio" numeric(18,6), "subtotal" numeric(18,4) NOT NULL, "descuento" numeric(18,4) NOT NULL DEFAULT '0', "total" numeric(18,4) NOT NULL, "metodo_pago" character varying(3), "forma_pago" character varying(2), "estado" character varying(32) NOT NULL DEFAULT 'abierta', "xml_raw" jsonb NOT NULL, CONSTRAINT "ck_cfdi_xml_raw_integro" CHECK (jsonb_typeof(xml_raw) = 'object' AND xml_raw ? '_xml'), CONSTRAINT "ck_cfdi_total_no_negativo" CHECK (total >= 0 AND subtotal >= 0 AND descuento >= 0), CONSTRAINT "ck_cfdi_tipo_comprobante" CHECK (tipo_comprobante IN ('I', 'E', 'T', 'N', 'P')), CONSTRAINT "ck_cfdi_estado" CHECK (estado IN ('abierta', 'conciliada', 'cancelada')), CONSTRAINT "PK_c4cc94cff7295f75c3565e4c065" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_cfdi_carga_id" ON "cfdi"  ("carga_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_cfdi_company_id_total" ON "cfdi"  ("company_id", "total") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_cfdi_company_id_fecha_emision" ON "cfdi"  ("company_id", "fecha_emision") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_cfdi_company_id_rfc_emisor_abierta" ON "cfdi"  ("company_id", "rfc_emisor") WHERE estado = 'abierta'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_cfdi_company_id_uuid_fiscal" ON "cfdi"  ("company_id", "uuid_fiscal") `,
    );
    await queryRunner.query(
      `CREATE TABLE "movimientos" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "carga_id" uuid, "linea_numero" integer NOT NULL, "fecha" date NOT NULL, "descripcion" text NOT NULL, "referencia" character varying(128), "monto" numeric(18,4) NOT NULL, "moneda" character(3) NOT NULL DEFAULT 'MXN', "banco" character varying(128), "cuenta" character varying(32), "estado" character varying(32) NOT NULL DEFAULT 'abierto', CONSTRAINT "ck_movimientos_linea_numero" CHECK (linea_numero >= 0), CONSTRAINT "ck_movimientos_monto_no_cero" CHECK (monto <> 0), CONSTRAINT "ck_movimientos_estado" CHECK (estado IN ('abierto', 'conciliado', 'descartado')), CONSTRAINT "PK_519702aa97def3e7c1b6cc5e2f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_movimientos_company_id_referencia" ON "movimientos"  ("company_id", "referencia") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_movimientos_company_id_monto" ON "movimientos"  ("company_id", "monto") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_movimientos_company_id_fecha_abierto" ON "movimientos"  ("company_id", "fecha") WHERE estado = 'abierto'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_movimientos_company_carga_linea" ON "movimientos"  ("company_id", "carga_id", "linea_numero") `,
    );
    await queryRunner.query(
      `CREATE TABLE "conciliaciones" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "cfdi_id" uuid NOT NULL, "movimiento_id" uuid NOT NULL, "estado" character varying(32) NOT NULL DEFAULT 'propuesta', "origen" character varying(32) NOT NULL, "regla" character varying(64), "score" numeric(5,4), "diferencia_monto" numeric(18,4), "motivo" text, "confirmada_por_id" uuid, "confirmada_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ck_conciliaciones_confirmada_requiere_persona" CHECK (estado <> 'confirmada' OR (confirmada_por_id IS NOT NULL AND confirmada_at IS NOT NULL)), CONSTRAINT "ck_conciliaciones_score_rango" CHECK (score IS NULL OR (score >= 0 AND score <= 1)), CONSTRAINT "ck_conciliaciones_origen" CHECK (origen IN ('regla', 'llm', 'manual')), CONSTRAINT "ck_conciliaciones_estado" CHECK (estado IN ('propuesta', 'confirmada', 'rechazada')), CONSTRAINT "PK_4cf14ab22a0f3df9e85c2b56163" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_conciliaciones_company_id_estado" ON "conciliaciones"  ("company_id", "estado") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_conciliaciones_par" ON "conciliaciones"  ("company_id", "cfdi_id", "movimiento_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_conciliaciones_movimiento_confirmada" ON "conciliaciones"  ("company_id", "movimiento_id") WHERE estado = 'confirmada'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_conciliaciones_cfdi_confirmada" ON "conciliaciones"  ("company_id", "cfdi_id") WHERE estado = 'confirmada'`,
    );
    await queryRunner.query(
      `CREATE TABLE "bitacora" ("id" uuid NOT NULL DEFAULT uuidv7(), "company_id" uuid NOT NULL, "user_id" uuid, "entidad" character varying(64) NOT NULL, "entidad_id" uuid NOT NULL, "accion" character varying(32) NOT NULL, "datos" jsonb, "ip" inet, "user_agent" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar')), CONSTRAINT "PK_e08eb7c81388757d9e53d62246e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bitacora_company_id_entidad" ON "bitacora"  ("company_id", "entidad", "entidad_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bitacora_company_id_created_at" ON "bitacora"  ("company_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" ADD CONSTRAINT "fk_user_company_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" ADD CONSTRAINT "fk_user_company_roles_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "fk_cargas_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "fk_cargas_subido_por" FOREIGN KEY ("subido_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" ADD CONSTRAINT "fk_cfdi_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" ADD CONSTRAINT "fk_cfdi_carga" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "fk_movimientos_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "fk_movimientos_carga" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_cfdi" FOREIGN KEY ("cfdi_id") REFERENCES "cfdi"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_movimiento" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_confirmada_por" FOREIGN KEY ("confirmada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "fk_bitacora_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "fk_bitacora_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "fk_bitacora_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "fk_bitacora_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_confirmada_por"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_movimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_cfdi"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "fk_movimientos_carga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "fk_movimientos_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" DROP CONSTRAINT "fk_cfdi_carga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" DROP CONSTRAINT "fk_cfdi_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "fk_cargas_subido_por"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "fk_cargas_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" DROP CONSTRAINT "fk_user_company_roles_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" DROP CONSTRAINT "fk_user_company_roles_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_bitacora_company_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_bitacora_company_id_entidad"`,
    );
    await queryRunner.query(`DROP TABLE "bitacora"`);
    await queryRunner.query(
      `DROP INDEX "public"."ux_conciliaciones_cfdi_confirmada"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_conciliaciones_movimiento_confirmada"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ux_conciliaciones_par"`);
    await queryRunner.query(
      `DROP INDEX "public"."ix_conciliaciones_company_id_estado"`,
    );
    await queryRunner.query(`DROP TABLE "conciliaciones"`);
    await queryRunner.query(
      `DROP INDEX "public"."ux_movimientos_company_carga_linea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_movimientos_company_id_fecha_abierto"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_movimientos_company_id_monto"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_movimientos_company_id_referencia"`,
    );
    await queryRunner.query(`DROP TABLE "movimientos"`);
    await queryRunner.query(
      `DROP INDEX "public"."ux_cfdi_company_id_uuid_fiscal"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_cfdi_company_id_rfc_emisor_abierta"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_cfdi_company_id_fecha_emision"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_cfdi_company_id_total"`);
    await queryRunner.query(`DROP INDEX "public"."ix_cfdi_carga_id"`);
    await queryRunner.query(`DROP TABLE "cfdi"`);
    await queryRunner.query(
      `DROP INDEX "public"."ix_cargas_company_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_cargas_company_id_hash_archivo"`,
    );
    await queryRunner.query(`DROP TABLE "cargas"`);
    await queryRunner.query(
      `DROP INDEX "public"."ux_user_company_roles_user_company_rol"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_user_company_roles_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_company_roles"`);
    await queryRunner.query(`DROP INDEX "public"."ux_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."ux_companies_rfc"`);
    await queryRunner.query(`DROP TABLE "companies"`);
  }
}
