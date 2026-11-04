import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 4.1 (AD-4): huella del conjunto de facturas de una decisión.
 * - `huella_conjunto(ids uuid[])`: el mismo cálculo que `huellaConjunto`
 *   (src/conciliacion/huella-conjunto.ts); la prueba de paridad lo vigila.
 *   `'v1:' || sha256_hex('v1|id1|id2|...')`:
 *     - los ids se ordenan ascendente por su valor `uuid`, así que el orden de
 *       entrada no cambia la huella;
 *     - el tipo `uuid` normaliza a minúsculas, y el espejo TS también;
 *     - los duplicados se conservan: quien arma la decisión no los repite;
 *     - la lista vacía es válida y da la huella de `'v1|'`.
 *   Si cambia la canonicalización se sube la versión en ambos lados.
 *
 * No hay tabla nueva: RLS y GRANTs no cambian. La función necesita EXECUTE
 * para `cuadra_app`, que es quien creará las decisiones.
 */
const ROL_APP = 'cuadra_app';

export class HuellaConjunto1790710800000 implements MigrationInterface {
  name = 'HuellaConjunto1790710800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION huella_conjunto(ids uuid[]) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
      AS $$
        SELECT 'v1:' || encode(sha256(convert_to(
          'v1|' || coalesce(
            (SELECT string_agg(id::text, '|' ORDER BY id) FROM unnest(ids) AS id),
            ''),
          'UTF8')), 'hex')
      $$`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION huella_conjunto(uuid[]) TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION huella_conjunto(uuid[])`);
  }
}
