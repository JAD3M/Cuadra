import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 6.2 (AD-10, AD-4, AD-12, FR-35). `evidencia_sombra` suma lo que la
 * persona hizo después con una propuesta de la regla 1: `confirmo`, `rechazo`,
 * `desmarco` y `reabrio`. Solo se reescribe el CHECK de `evento`; la tabla, su
 * RLS con FORCE y los GRANTs (solo SELECT e INSERT) no cambian.
 *
 * El CHECK debe coincidir con `EVENTOS_SOMBRA` (src/common/entities/tipos.ts).
 * El índice único parcial de `habria_cerrado` no cubre los eventos nuevos a
 * propósito: `desmarco` puede repetirse sobre la misma decisión en lotes
 * distintos, y la tasa de desacuerdo cuenta por decisión.
 *
 * `down` falla si ya hay filas con los eventos nuevos: no se borra evidencia en
 * silencio. Quitarlas es una decisión manual, con respaldo (docs/despliegue.md).
 */
export class EventosDeLaPersonaEnSombra1790720000000 implements MigrationInterface {
  name = 'EventosDeLaPersonaEnSombra1790720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" DROP CONSTRAINT "ck_evidencia_sombra_evento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ADD CONSTRAINT "ck_evidencia_sombra_evento" CHECK (evento IN ('habria_cerrado', 'confirmo', 'rechazo', 'desmarco', 'reabrio'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" DROP CONSTRAINT "ck_evidencia_sombra_evento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ADD CONSTRAINT "ck_evidencia_sombra_evento" CHECK (evento IN ('habria_cerrado'))`,
    );
  }
}
