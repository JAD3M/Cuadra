import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 3.5 (FR-65): huella de movimientos para detectar el mismo
 * movimiento en dos archivos.
 * - `huella_movimiento(cuenta, fecha, monto, referencia)`: el mismo cálculo
 *   que `huellaMovimiento` (src/bancos/huella-movimiento.ts); la prueba de
 *   paridad lo vigila. `'v1:' || sha256_hex('v1|cuenta|fecha|monto|ref')`:
 *     - cuenta: solo [A-Za-z0-9], en mayúsculas (translate, no upper(): no
 *       depende del locale); nula es '';
 *     - fecha: YYYY-MM-DD;
 *     - monto: exactamente 4 decimales;
 *     - referencia: `normalizar_referencia`; nula es ''.
 *   Si cambia la canonicalización se sube la versión en ambos lados.
 * - `movimientos.huella` varchar(70) NULL e índice (company_id, huella) NO
 *   único: dos cargos idénticos el mismo día son legítimos (CUADRA.md).
 * - Backfill de las filas existentes con la misma función. `movimientos` tiene
 *   RLS FORCE y el dueño tampoco se la salta, así que se rellena empresa por
 *   empresa fijando `app.company_id` dentro de la transacción de la migración.
 * - `ck_movimientos_estado` suma 'pendiente_revision': un movimiento dudoso
 *   (misma huella, referencia cruda distinta) que queda fuera de la
 *   conciliación y de la bandeja hasta que alguien lo resuelva.
 *   `movimientos_pendientes` no lleva huella: el clasificador la calcula de sus
 *   filas al aceptar la vista previa.
 *
 * Los CHECK van a mano: TypeORM no compara su texto. La lista de estados debe
 * coincidir con `ESTADOS_MOVIMIENTO` (src/common/entities/tipos.ts).
 *
 * No hay tabla nueva: RLS y GRANTs de `movimientos` no cambian. La función
 * necesita EXECUTE para `cuadra_app`, que es quien clasificará al importar.
 *
 * `down` no borra datos: con un movimiento 'pendiente_revision' el ADD
 * CONSTRAINT falla y qué hacer con él es trabajo de una persona.
 */
const ROL_APP = 'cuadra_app';

/** Rellena solo lo que no tiene huella; idempotente. Lo usa la prueba de paridad. */
export const SQL_BACKFILL_HUELLA = `UPDATE "movimientos"
   SET "huella" = huella_movimiento("cuenta", "fecha", "monto", "referencia")
 WHERE "huella" IS NULL`;

export class HuellaMovimientos1790710400000 implements MigrationInterface {
  name = 'HuellaMovimientos1790710400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION huella_movimiento(
        cuenta text, fecha date, monto numeric, referencia text
      ) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
      AS $$
        SELECT 'v1:' || encode(sha256(convert_to(
          'v1|'
          || translate(
               regexp_replace(coalesce(cuenta, ''), '[^A-Za-z0-9]', '', 'g'),
               'abcdefghijklmnopqrstuvwxyz',
               'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
          || '|' || to_char(fecha, 'YYYY-MM-DD')
          || '|' || round(monto, 4)::text
          || '|' || coalesce(normalizar_referencia(referencia), ''),
          'UTF8')), 'hex')
      $$`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION huella_movimiento(text, date, numeric, text) TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "huella" character varying(70)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_movimientos_company_id_huella" ON "movimientos" ("company_id", "huella")`,
    );

    const empresas = (await queryRunner.query(
      `SELECT id FROM "companies"`,
    )) as Array<{ id: string }>;
    for (const { id } of empresas) {
      await queryRunner.query(`SELECT set_config('app.company_id', $1, true)`, [
        id,
      ]);
      await queryRunner.query(SQL_BACKFILL_HUELLA);
    }
    await queryRunner.query(`SELECT set_config('app.company_id', '', true)`);

    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_estado" CHECK (estado IN ('abierto', 'conciliado', 'descartado', 'pendiente_revision'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_estado" CHECK (estado IN ('abierto', 'conciliado', 'descartado'))`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_movimientos_company_id_huella"`,
    );
    await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "huella"`);
    await queryRunner.query(
      `DROP FUNCTION huella_movimiento(text, date, numeric, text)`,
    );
  }
}
