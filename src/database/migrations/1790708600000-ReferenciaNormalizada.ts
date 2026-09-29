import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-11 (RN-4). `movimientos.referencia_norm`: la referencia bancaria ya
 * normalizada, generada por la base para que ninguna ruta de inserción pueda
 * olvidarla ni calcularla distinto.
 *
 * `normalizar_referencia` implementa RN-1 y debe coincidir con
 * `normalizarReferencia` (TS); la prueba de paridad lo vigila:
 *   1. se descarta todo lo que no sea [A-Za-z0-9];
 *   2. mayúsculas (translate, no upper(): no depende del locale);
 *   3. ceros a la izquierda solo del primer bloque de dígitos que sigue a las
 *      letras iniciales, dejando al menos un dígito;
 *   4. vacío es NULL.
 * Las clases van explícitas y en ASCII para que el locale no las ensanche.
 *
 * TypeORM no lee la expresión de una columna generada desde Postgres sino de
 * `typeorm_metadata`; sin esa fila `esquema.spec` vería deriva. La fila se
 * inserta aquí y `down` la retira. La tabla no la crea ni la borra la
 * migración: el ejecutor de TypeORM la crea en cada corrida en cuanto una
 * entidad declara una columna generada (decisión de diseño, ver CUADRA.md).
 *
 * No hay tabla nueva: RLS y GRANTs de `movimientos` no cambian. La función
 * necesita EXECUTE para `cuadra_app`, que es quien inserta.
 */
export class ReferenciaNormalizada1790708600000 implements MigrationInterface {
  name = 'ReferenciaNormalizada1790708600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION normalizar_referencia(texto text) RETURNS text
        LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
      AS $$
        SELECT NULLIF(
          regexp_replace(
            translate(
              regexp_replace(texto, '[^A-Za-z0-9]', '', 'g'),
              'abcdefghijklmnopqrstuvwxyz',
              'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
            '^([A-Z]*)0+(?=[0-9])', '\\1'),
          '')
      $$`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION normalizar_referencia(text) TO cuadra_app`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata" ("type", "database", "schema", "table", "name", "value")
       VALUES ('GENERATED_COLUMN', current_database(), 'public', 'movimientos', 'referencia_norm', 'normalizar_referencia(referencia)')`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "referencia_norm" character varying(128) GENERATED ALWAYS AS (normalizar_referencia(referencia)) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_movimientos_company_id_referencia_norm" ON "movimientos" ("company_id", "referencia_norm")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "ix_movimientos_company_id_referencia_norm"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP COLUMN "referencia_norm"`,
    );
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'GENERATED_COLUMN' AND "table" = 'movimientos' AND "name" = 'referencia_norm'`,
    );
    await queryRunner.query(`DROP FUNCTION normalizar_referencia(text)`);
  }
}
