import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 9.5 (FR-37, SM-C1, AD-5, AD-10). La condición del PRD para
 * considerar el cierre automático cruza todas las empresas. `evidencia_sombra`,
 * `decisiones`, `movimientos` y `muestras_verificacion` tienen RLS FORCE y
 * `cuadra_app` solo ve su empresa, así que la función es SECURITY DEFINER y
 * devuelve una sola fila de conteos: nunca filas, ids de decisión, montos ni
 * RFC. No se guarda nada; el servicio evalúa la condición en cada consulta.
 *
 * - `empresas` y `meses` salen de la misma población que
 *   `desacuerdo_por_empresa_y_banco()` (9.2): decisiones con evento
 *   `habria_cerrado`, con su movimiento. `meses` son meses calendario (UTC)
 *   distintos del evento.
 * - `verificados` y `desacuerdos_muestra` cuentan, por empresa, mes y decisión
 *   de la muestra, solo su última marca (9.4: vale la última).
 *
 * Mismas reglas que las otras funciones de plataforma: `search_path` fijo, sin
 * SQL dinámico, EXECUTE solo para `cuadra_app` (la ruta exige sesión de
 * plataforma) y dueño de la función con permiso de saltarse RLS, o vería cero
 * filas y mentiría en silencio.
 */
const ROL_APP = 'cuadra_app';

export class ConteosCondicionCierre1790725000000 implements MigrationInterface {
  name = 'ConteosCondicionCierre1790725000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
        ) THEN
          RAISE EXCEPTION 'El rol que migra (%) debe poder saltarse RLS: conteos_condicion_cierre() contaría cero.', current_user;
        END IF;
      END
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION conteos_condicion_cierre()
      RETURNS TABLE (
        empresas bigint,
        meses bigint,
        verificados bigint,
        desacuerdos_muestra bigint
      )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
      AS $$
        WITH propuestas AS (
          SELECT h.company_id, h.created_at
            FROM public.evidencia_sombra h
            JOIN public.decisiones d
              ON d.id = h.decision_id AND d.company_id = h.company_id
            JOIN public.movimientos m
              ON m.id = d.movimiento_id AND m.company_id = h.company_id
           WHERE h.evento = 'habria_cerrado'
        ),
        ultima_marca AS (
          SELECT DISTINCT ON (v.company_id, v.mes, v.decision_id) v.resultado
            FROM public.muestras_verificacion v
           WHERE v.resultado IS NOT NULL
           ORDER BY v.company_id, v.mes, v.decision_id, v.created_at DESC, v.id DESC
        )
        SELECT
          (SELECT count(DISTINCT p.company_id) FROM propuestas p),
          (SELECT count(DISTINCT date_trunc('month', p.created_at AT TIME ZONE 'UTC'))
             FROM propuestas p),
          (SELECT count(*) FROM ultima_marca),
          (SELECT count(*) FROM ultima_marca WHERE resultado = 'desacuerdo')
      $$`);
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION conteos_condicion_cierre() FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION conteos_condicion_cierre() TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION conteos_condicion_cierre() FROM ${ROL_APP}`,
    );
    await queryRunner.query(`DROP FUNCTION conteos_condicion_cierre()`);
  }
}
