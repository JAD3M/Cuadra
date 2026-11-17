import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 9.2 (FR-37, AD-5, AD-10). El dueño ve la tasa de desacuerdo por
 * empresa y por banco. `evidencia_sombra`, `decisiones` y `movimientos` tienen
 * RLS FORCE y `cuadra_app` solo ve su empresa, así que la función es SECURITY
 * DEFINER y devuelve solo conteos por (empresa, banco): nunca filas, ids de
 * decisión, montos ni RFC. No se guarda nada; la tasa se calcula en el servicio.
 *
 * La definición de desacuerdo es la de la 6.2 (`SombraService.tasaDesacuerdo`),
 * con la misma lógica agrupada por empresa y banco. Una prueba exige que la
 * suma por empresa coincida con esa consulta, para que no se desincronicen.
 * Una decisión cuenta bajo el banco de su evento `habria_cerrado`. `banco` es
 * nulable en la evidencia: esas propuestas salen con `banco` nulo.
 *
 * Mismas reglas que `fracciones_por_empresa()`: `search_path` fijo, sin SQL
 * dinámico, EXECUTE solo para `cuadra_app` (el controlador exige sesión de
 * plataforma) y dueño de la función con permiso de saltarse RLS, o vería cero
 * filas y mentiría en silencio.
 */
const ROL_APP = 'cuadra_app';

export class DesacuerdoPorEmpresaYBanco1790722000000
  implements MigrationInterface
{
  name = 'DesacuerdoPorEmpresaYBanco1790722000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
        ) THEN
          RAISE EXCEPTION 'El rol que migra (%) debe poder saltarse RLS: desacuerdo_por_empresa_y_banco() contaría cero.', current_user;
        END IF;
      END
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION desacuerdo_por_empresa_y_banco()
      RETURNS TABLE (
        company_id uuid,
        banco character varying,
        propuestas bigint,
        tratadas bigint,
        desacuerdos bigint
      )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
      AS $$
        WITH por_decision AS (
          SELECT h.company_id, h.banco, h.decision_id,
                 COALESCE(bool_or(e.evento IN ('rechazo', 'reabrio')), false) AS contradijo,
                 COALESCE(bool_or(e.evento = 'desmarco'), false) AS desmarco,
                 COALESCE(bool_or(e.evento = 'confirmo'), false) AS confirmo,
                 COALESCE(bool_or(e.evento <> 'habria_cerrado'), false) AS tocada,
                 (d.estado <> 'propuesta' OR m.estado <> 'abierto') AS resuelta
            FROM public.evidencia_sombra h
            JOIN public.decisiones d
              ON d.id = h.decision_id AND d.company_id = h.company_id
            JOIN public.movimientos m
              ON m.id = d.movimiento_id AND m.company_id = h.company_id
            LEFT JOIN public.evidencia_sombra e
              ON e.decision_id = h.decision_id AND e.company_id = h.company_id
           WHERE h.evento = 'habria_cerrado'
           GROUP BY h.company_id, h.banco, h.decision_id, d.estado, m.estado
        ),
        clasificada AS (
          SELECT p.company_id, p.banco,
                 (p.tocada AND (p.contradijo OR p.confirmo OR NOT p.desmarco OR p.resuelta)) AS tratada,
                 (p.contradijo OR (p.desmarco AND NOT p.confirmo AND p.resuelta)) AS desacuerdo
            FROM por_decision p
        )
        SELECT c.company_id, c.banco,
               count(*),
               count(*) FILTER (WHERE c.tratada),
               count(*) FILTER (WHERE c.tratada AND c.desacuerdo)
          FROM clasificada c
         GROUP BY c.company_id, c.banco
         ORDER BY c.company_id, c.banco
      $$`);
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION desacuerdo_por_empresa_y_banco() FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION desacuerdo_por_empresa_y_banco() TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION desacuerdo_por_empresa_y_banco() FROM ${ROL_APP}`,
    );
    await queryRunner.query(`DROP FUNCTION desacuerdo_por_empresa_y_banco()`);
  }
}
