import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type QueryRunner } from 'typeorm';
import { huellaDeToken, nuevoToken } from '../auth/sesiones.service';
import { ProveedorCorreo } from '../correo/proveedor-correo';
import type { InvitacionEnviadaDto } from './dto/plataforma.dto';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/** Vigencia del enlace (decisión de la historia 1.5). */
const VIGENCIA_DIAS = 7;

const ROL_INVITADO = 'admin';

/**
 * Historia 1.5 (FR-40, AD-14). El dueño invita a la primera persona
 * administradora de una empresa. No ramifica por la existencia de la cuenta:
 * siempre reemplaza la invitación viva, crea la nueva y manda el correo, así
 * la respuesta no revela quién tiene cuenta.
 *
 * SQL explícito sobre `invitaciones`, `bitacora` y `bitacora_plataforma`, en
 * una sola transacción como la 1.4: si la bitácora de plataforma falla (aquí
 * lanza), no queda invitación. El correo sale después del commit y el token
 * en claro solo existe en ese mensaje: nunca se guarda ni se registra.
 */
@Injectable()
export class InvitacionesPlataforma {
  private readonly logger = new Logger(InvitacionesPlataforma.name);

  constructor(
    private readonly ds: DataSource,
    private readonly correo: ProveedorCorreo,
    private readonly config: ConfigService,
  ) {}

  async invitar(
    companyId: string,
    email: string,
    plataformaUsuarioId: string,
  ): Promise<InvitacionEnviadaDto> {
    const [empresa] = await this.ds.query<Array<{ razonSocial: string }>>(
      `SELECT razon_social AS "razonSocial" FROM companies WHERE id = $1`,
      [companyId],
    );
    if (!empresa) throw new NotFoundException('La empresa no existe');

    const token = nuevoToken();
    try {
      await this.guardar(companyId, email, token, plataformaUsuarioId);
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      // Otra invitación al mismo correo ganó la carrera por la viva: se
      // reintenta una vez, ya reemplazándola.
      await this.guardar(companyId, email, token, plataformaUsuarioId);
    }

    const origen = this.config.getOrThrow<string>('ORIGEN_AUTORIZADO');
    try {
      await this.correo.enviar({
        para: email,
        asunto: `Invitación para administrar ${empresa.razonSocial} en Cuadra`,
        texto: [
          `Te invitaron a administrar ${empresa.razonSocial} en Cuadra.`,
          '',
          'Abre este enlace para aceptar la invitación. Sirve una sola vez y vence en 7 días:',
          `${origen}/invitacion/${token}`,
        ].join('\n'),
      });
    } catch (error) {
      // Nunca el mensaje ni el enlace: solo que falló y por qué.
      this.logger.error(
        `No se pudo enviar la invitación de la empresa ${companyId}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo. Vuelve a invitar para generar un enlace nuevo.',
      );
    }
    return { email };
  }

  private async guardar(
    companyId: string,
    email: string,
    token: string,
    plataformaUsuarioId: string,
  ): Promise<void> {
    const qr: QueryRunner = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(
        `UPDATE invitaciones SET reemplazada_en = now(), updated_at = now()
          WHERE company_id = $1 AND email = $2
            AND consumida_en IS NULL AND reemplazada_en IS NULL`,
        [companyId, email],
      );
      const [invitacion] = (await qr.query(
        `INSERT INTO invitaciones
           (company_id, email, roles, token_hash, expires_at, invitada_por_plataforma_usuario_id)
         VALUES ($1, $2, $3::text[], $4, now() + make_interval(days => $5), $6)
         RETURNING id`,
        [
          companyId,
          email,
          [ROL_INVITADO],
          huellaDeToken(token),
          VIGENCIA_DIAS,
          plataformaUsuarioId,
        ],
      )) as Array<{ id: string }>;
      // Local a la transacción, para que la política de `bitacora` deje escribir.
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        companyId,
      ]);
      await qr.query(
        `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         VALUES ($1, NULL, 'companies', $1, 'invitar', $2::jsonb)`,
        [
          companyId,
          JSON.stringify({
            plataformaUsuarioId,
            invitacionId: invitacion.id,
            email,
            rol: ROL_INVITADO,
          }),
        ],
      );
      await qr.query(
        `INSERT INTO bitacora_plataforma (plataforma_usuario_id, accion, company_id, detalle)
         VALUES ($1, 'invitar', $2, $3::jsonb)`,
        [
          plataformaUsuarioId,
          companyId,
          JSON.stringify({
            invitacionId: invitacion.id,
            email,
            rol: ROL_INVITADO,
          }),
        ],
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
