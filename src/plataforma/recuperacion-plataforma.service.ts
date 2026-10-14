import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type QueryRunner } from 'typeorm';
import { huellaDeToken, nuevoToken } from '../auth/sesiones.service';
import { ProveedorCorreo } from '../correo/proveedor-correo';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/** Vigencia del enlace: una hora, igual que la de empresa. */
const VIGENCIA_HORAS = 1;

/**
 * Historia 1.6 (FR-43, AD-14). Mitad de plataforma de la recuperación de
 * contraseña: solo aquí se nombra `plataforma_usuarios` (AD-2). La mitad
 * pública (rutas, consulta del enlace, consumo) vive en `recuperacion/` y
 * llama a este servicio.
 *
 * - `solicitar` no revela nada: si no hay cuenta activa con ese correo, no
 *   hace nada. Si la hay, reemplaza el enlace vivo, crea el nuevo y manda el
 *   correo después del commit. El fallo de envío se registra, no se propaga.
 * - `restablecer` corre dentro de la transacción de quien llama, para que el
 *   cambio de contraseña, el consumo del enlace y el borrado de sesiones
 *   sean atómicos.
 */
@Injectable()
export class RecuperacionPlataforma {
  private readonly logger = new Logger(RecuperacionPlataforma.name);

  constructor(
    private readonly ds: DataSource,
    private readonly correo: ProveedorCorreo,
    private readonly config: ConfigService,
  ) {}

  async solicitar(correo: string): Promise<void> {
    const [cuenta] = await this.ds.query<Array<{ id: string }>>(
      `SELECT id FROM plataforma_usuarios WHERE correo = $1 AND activo`,
      [correo],
    );
    if (!cuenta) return;

    const token = nuevoToken();
    try {
      await this.guardar(cuenta.id, token);
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      await this.guardar(cuenta.id, token);
    }

    const origen = this.config.getOrThrow<string>('ORIGEN_AUTORIZADO');
    try {
      await this.correo.enviar({
        para: correo,
        asunto: 'Restablece tu contraseña de Cuadra',
        texto: [
          'Pediste restablecer la contraseña de tu cuenta de plataforma de Cuadra.',
          '',
          `Abre este enlace para elegir una nueva. Sirve una sola vez y vence en ${VIGENCIA_HORAS} hora:`,
          `${origen}/recuperar/${token}`,
          '',
          'Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.',
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el enlace de recuperación de la cuenta de plataforma ${cuenta.id}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Cambia la contraseña, borra las sesiones de la cuenta y deja rastro en
   * `bitacora_plataforma`, todo en la transacción `qr` de quien llama.
   * Devuelve `false` si la cuenta ya no está activa (no se cambia nada).
   */
  async restablecer(
    qr: QueryRunner,
    plataformaUsuarioId: string,
    passwordHash: string,
  ): Promise<boolean> {
    const activas = (await qr.query(
      `SELECT id FROM plataforma_usuarios WHERE id = $1 AND activo FOR UPDATE`,
      [plataformaUsuarioId],
    )) as Array<{ id: string }>;
    if (activas.length === 0) return false;
    await qr.query(
      `UPDATE plataforma_usuarios SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [plataformaUsuarioId, passwordHash],
    );
    await qr.query(`DELETE FROM sesiones WHERE plataforma_usuario_id = $1`, [
      plataformaUsuarioId,
    ]);
    await qr.query(
      `INSERT INTO bitacora_plataforma (plataforma_usuario_id, accion, detalle)
       VALUES ($1, 'restablecer_contrasena', $2::jsonb)`,
      [plataformaUsuarioId, JSON.stringify({ medio: 'enlace_por_correo' })],
    );
    return true;
  }

  private async guardar(
    plataformaUsuarioId: string,
    token: string,
  ): Promise<void> {
    const qr: QueryRunner = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(
        `UPDATE tokens_recuperacion SET reemplazada_en = now(), updated_at = now()
          WHERE plataforma_usuario_id = $1 AND consumida_en IS NULL AND reemplazada_en IS NULL`,
        [plataformaUsuarioId],
      );
      await qr.query(
        `INSERT INTO tokens_recuperacion (plataforma_usuario_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(hours => $3))`,
        [plataformaUsuarioId, huellaDeToken(token), VIGENCIA_HORAS],
      );
      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
