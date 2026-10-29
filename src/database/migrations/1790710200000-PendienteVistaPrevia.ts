import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 3.3 (FR-1, FR-2, FR-52).
 * - `ck_cargas_estado` suma 'pendiente_vista_previa': el PDF cuadró y sus
 *   movimientos esperan la vista previa (3.4). `ck_cargas_total_cuadra` no
 *   cambia: en un estado que no es procesada ni con_errores solo exige que
 *   los contadores no pasen del total, y esta carga los trae en cero.
 * - `movimientos_pendientes`: la zona de espera. Mismas columnas de dato que
 *   `movimientos`, montos NUMERIC. Tabla de dominio: company_id, RLS con
 *   FORCE, política y GRANTs aquí mismo (CLAUDE.md). Sin UPDATE ni DELETE
 *   todavía: el paso a `movimientos` (3.4) concederá lo que necesite.
 * - `bitacora.entidad_id` admite NULL solo para 'rechazar': un PDF rechazado
 *   no crea carga, así que no hay entidad a la que apuntar.
 *
 * Los CHECK van a mano: TypeORM no compara su texto. La lista de estados
 * debe coincidir con `ESTADOS_CARGA` (src/common/entities/tipos.ts).
 *
 * `down` no borra datos: con una carga en 'pendiente_vista_previa' o una fila
 * de bitácora sin entidad, el ADD CONSTRAINT / SET NOT NULL falla y qué hacer
 * con ellas es trabajo de una persona (la bitácora es append-only).
 */
const ROL_APP = 'cuadra_app';

export class PendienteVistaPrevia1790710200000 implements MigrationInterface {
  name = 'PendienteVistaPrevia1790710200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'con_errores', 'fallida', 'pendiente_vista_previa'))`,
    );

    await queryRunner.query(
      `CREATE TABLE "movimientos_pendientes" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "carga_id" uuid NOT NULL, "linea_numero" integer NOT NULL, "fecha" date NOT NULL, "descripcion" text NOT NULL, "referencia" character varying(128), "monto" numeric(18,4) NOT NULL, "moneda" character(3) NOT NULL DEFAULT 'MXN', "banco" character varying(128), "cuenta" character varying(32), CONSTRAINT "ck_movimientos_pendientes_linea_numero" CHECK (linea_numero >= 0), CONSTRAINT "ck_movimientos_pendientes_monto_no_cero" CHECK (monto <> 0), CONSTRAINT "PK_movimientos_pendientes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_movimientos_pendientes_company_carga_linea" ON "movimientos_pendientes" ("company_id", "carga_id", "linea_numero")`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" ADD CONSTRAINT "fk_movimientos_pendientes_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" ADD CONSTRAINT "fk_movimientos_pendientes_carga" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_movimientos_pendientes_company" ON "movimientos_pendientes"
         USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
         WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "movimientos_pendientes" TO ${ROL_APP}`,
    );

    await queryRunner.query(
      `ALTER TABLE "bitacora" ALTER COLUMN "entidad_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_entidad_id_solo_rechazo" CHECK (entidad_id IS NOT NULL OR accion = 'rechazar')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_entidad_id_solo_rechazo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ALTER COLUMN "entidad_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `REVOKE ALL ON "movimientos_pendientes" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" DROP CONSTRAINT "fk_movimientos_pendientes_carga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos_pendientes" DROP CONSTRAINT "fk_movimientos_pendientes_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_movimientos_pendientes_company_carga_linea"`,
    );
    // La política se va con la tabla.
    await queryRunner.query(`DROP TABLE "movimientos_pendientes"`);

    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'con_errores', 'fallida'))`,
    );
  }
}
