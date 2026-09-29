import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-07.
 * - `registros_existentes`: CFDI cuyo UUID ya estaba en la empresa. No es
 *   error ni se duplica.
 * - `ck_cargas_total_cuadra`: cada archivo cae en exactamente un contador.
 * - `errores` pasa a `resultados`: un elemento por archivo con
 *   'nuevo' | 'ya_existia' | 'error'. Los errores que ya había se conservan
 *   con resultado 'error'; de los archivos que entraron antes de esta
 *   migración no quedó registro, así que no se inventan.
 *
 * Los CHECK van a mano: TypeORM no compara su texto. Sin GRANTs nuevos: los
 * de tabla cubren la columna nueva y el renombre.
 */
export class CargaIdempotente1790640205218 implements MigrationInterface {
  name = 'CargaIdempotente1790640205218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "registros_existentes" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_conteos_no_negativos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_conteos_no_negativos" CHECK (total_registros >= 0 AND registros_ok >= 0 AND registros_error >= 0 AND registros_existentes >= 0)`,
    );
    // Si alguna carga previa no cuadra, esto falla y la migración se
    // detiene: corregir contadores es trabajo de una persona.
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_total_cuadra" CHECK (total_registros = registros_ok + registros_error + registros_existentes)`,
    );

    await queryRunner.query(
      `ALTER TABLE "cargas" RENAME COLUMN "errores" TO "resultados"`,
    );
    await queryRunner.query(
      `UPDATE "cargas"
          SET "resultados" = (
            SELECT jsonb_agg(e || '{"resultado": "error"}' ORDER BY n)
              FROM jsonb_array_elements("resultados") WITH ORDINALITY AS t(e, n)
          )
        WHERE jsonb_array_length("resultados") > 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // De vuelta a lo que guardaba `errores` en CU-06: solo fallos, sin la
    // llave `resultado`. Un 'ya_existia' era un error con este motivo; los
    // 'nuevo' no se guardaban.
    await queryRunner.query(
      `UPDATE "cargas"
          SET "resultados" = coalesce((
            SELECT jsonb_agg(
                     CASE e ->> 'resultado'
                       WHEN 'ya_existia' THEN jsonb_build_object(
                         'archivo', e -> 'archivo',
                         'motivo', 'El UUID de este CFDI ya existe en la empresa')
                       ELSE e - 'resultado'
                     END ORDER BY n)
              FROM jsonb_array_elements("resultados") WITH ORDINALITY AS t(e, n)
             WHERE e ->> 'resultado' IN ('error', 'ya_existia')
          ), '[]')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" RENAME COLUMN "resultados" TO "errores"`,
    );

    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_total_cuadra"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_conteos_no_negativos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_conteos_no_negativos" CHECK (total_registros >= 0 AND registros_ok >= 0 AND registros_error >= 0)`,
    );
    // Los ya existentes vuelven a contar como error, como en CU-06, para que
    // total = ok + error siga siendo cierto sin el contador nuevo.
    await queryRunner.query(
      `UPDATE "cargas" SET "registros_error" = "registros_error" + "registros_existentes"
        WHERE "registros_existentes" > 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP COLUMN "registros_existentes"`,
    );
  }
}
