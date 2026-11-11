import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 6.3 (FR-69, AD-10, AD-8). Mide cuántos movimientos son comisiones o
 * parcialidades y cuántas facturas son PPD, para que el dueño decida si alguno
 * entra a la v2. Solo mide: ninguna regla lee la clase.
 *
 * - `movimientos.clase`: 'comision', 'parcialidad' o nula. Columna nueva y
 *   nulable, sin relleno: lo importado antes queda en nulo. El CHECK debe
 *   coincidir con `CLASES_MOVIMIENTO` (src/common/entities/tipos.ts). RLS y
 *   GRANTs de `movimientos` no cambian.
 * - `fracciones_por_empresa()`: conteos por empresa (facturas, facturas PPD,
 *   movimientos, parcialidades, comisiones). `cfdi` y `movimientos` tienen RLS
 *   FORCE y `cuadra_app` solo ve su empresa, así que la función es SECURITY
 *   DEFINER y devuelve solo conteos, nunca filas. Las fracciones se calculan en
 *   la consulta del servicio; no se guarda nada. `search_path` fijo, sin SQL
 *   dinámico, EXECUTE solo para `cuadra_app` (el controlador exige sesión de
 *   plataforma).
 *
 * Dueño de la función: el rol que migra; debe poder saltarse RLS o la función
 * vería cero filas y mentiría en silencio (igual que `cargas_aceptadas_por_banco`).
 *
 * `down` quita la columna y la función: la clase es derivable de la
 * descripción y el monto, así que no se pierde información de negocio.
 */
const ROL_APP = 'cuadra_app';

export class ClaseDeMovimiento1790721000000 implements MigrationInterface {
  name = 'ClaseDeMovimiento1790721000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "clase" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_clase" CHECK (clase IS NULL OR clase IN ('comision', 'parcialidad'))`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
        ) THEN
          RAISE EXCEPTION 'El rol que migra (%) debe poder saltarse RLS: fracciones_por_empresa() contaría cero.', current_user;
        END IF;
      END
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION fracciones_por_empresa()
      RETURNS TABLE (
        company_id uuid,
        total_cfdi bigint,
        cfdi_ppd bigint,
        total_movimientos bigint,
        parcialidades bigint,
        comisiones bigint
      )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
      AS $$
        SELECT c.id,
               (SELECT count(*) FROM public.cfdi f WHERE f.company_id = c.id),
               (SELECT count(*) FROM public.cfdi f
                 WHERE f.company_id = c.id AND f.metodo_pago = 'PPD'),
               (SELECT count(*) FROM public.movimientos m WHERE m.company_id = c.id),
               (SELECT count(*) FROM public.movimientos m
                 WHERE m.company_id = c.id AND m.clase = 'parcialidad'),
               (SELECT count(*) FROM public.movimientos m
                 WHERE m.company_id = c.id AND m.clase = 'comision')
          FROM public.companies c
         ORDER BY c.id
      $$`);
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION fracciones_por_empresa() FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION fracciones_por_empresa() TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION fracciones_por_empresa() FROM ${ROL_APP}`,
    );
    await queryRunner.query(`DROP FUNCTION fracciones_por_empresa()`);
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_clase"`,
    );
    await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "clase"`);
  }
}
