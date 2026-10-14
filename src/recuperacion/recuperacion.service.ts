import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type QueryRunner } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import { huellaDeToken, nuevoToken } from '../auth/sesiones.service';
import { exigirPasswordValida } from '../common/politica-contrasena';
import { ProveedorCorreo } from '../correo/proveedor-correo';
import { RecuperacionPlataforma } from '../plataforma/recuperacion-plataforma.service';
import type {
  EstadoRecuperacionDto,
  MotivoEnlaceInvalido,
} from './dto/recuperacion.dto';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/** Vigencia del enlace: una hora (decisión de la historia 1.6). */
export const VIGENCIA_HORAS = 1;

/** Respuesta única de "pedir enlace": no depende de si la cuenta existe. */
export const MENSAJE_SOLICITUD =
  'Si el correo corresponde a una cuenta activa, te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.';

export const MENSAJE_RESTABLECIDA =
  'Tu contraseña se actualizó. Inicia sesión con la nueva.';

const MENSAJES: Record<MotivoEnlaceInvalido, string> = {
  usada: 'Este enlace ya se usó. Pide uno nuevo si aún lo necesitas.',
  caducada: 'Este enlace venció. Pide uno nuevo.',
  reemplazada:
    'Este enlace fue reemplazado por uno más reciente. Usa el del correo nuevo.',
  desconocida: 'El enlace no es válido.',
};

interface FilaToken {
  id: string;
  userId: string | null;
  plataformaUsuarioId: string | null;
  consumida: boolean;
  reemplazada: boolean;
  caducada: boolean;
}

const SQL_TOKEN = `
  SELECT id, user_id AS "userId", plataforma_usuario_id AS "plataformaUsuarioId",
         consumida_en IS NOT NULL AS consumida,
         reemplazada_en IS NOT NULL AS reemplazada,
         expires_at <= now() AS caducada
    FROM tokens_recuperacion
   WHERE token_hash = $1`;

function motivoInvalido(fila: FilaToken): MotivoEnlaceInvalido | null {
  if (fila.consumida) return 'usada';
  if (fila.reemplazada) return 'reemplazada';
  if (fila.caducada) return 'caducada';
  return null;
}

function rechazar(motivo: MotivoEnlaceInvalido): never {
  if (motivo === 'desconocida') {
    throw new NotFoundException({
      statusCode: 404,
      message: MENSAJES.desconocida,
      motivo,
      error: 'Not Found',
    });
  }
  throw new GoneException({
    statusCode: 410,
    message: MENSAJES[motivo],
    motivo,
    error: 'Gone',
  });
}

/**
 * Historia 1.6 (FR-43, AD-14). Recuperar la contraseña por correo, sin
 * sesión. Cubre a las personas de empresa (`users`) y, por medio de
 * `RecuperacionPlataforma`, al dueño de plataforma (AD-2: aquí no se nombra
 * su tabla). Si el mismo correo existe en los dos mundos, cada cuenta recibe
 * su propio correo y su propio enlace. El token solo se compara por su
 * SHA-256 y nunca se guarda ni se registra en claro.
 */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly correo: ProveedorCorreo,
    private readonly config: ConfigService,
    private readonly plataforma: RecuperacionPlataforma,
  ) {}

  /**
   * No ramifica hacia afuera: exista, no exista o esté inactiva la cuenta,
   * termina igual. Un fallo de envío se registra y no cambia la respuesta
   * (un error distinto delataría que la cuenta existe).
   */
  async solicitar(email: string): Promise<void> {
    await this.solicitarEmpresa(email);
    await this.plataforma.solicitar(email);
  }

  private async solicitarEmpresa(email: string): Promise<void> {
    const [cuenta] = await this.ds.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE lower(email) = $1 AND activo`,
      [email],
    );
    if (!cuenta) return;

    const token = nuevoToken();
    try {
      await this.guardar(cuenta.id, token);
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      // Otra petición ganó la carrera por el enlace vivo: se reintenta una
      // vez, ya reemplazándolo.
      await this.guardar(cuenta.id, token);
    }

    const origen = this.config.getOrThrow<string>('ORIGEN_AUTORIZADO');
    try {
      await this.correo.enviar({
        para: email,
        asunto: 'Restablece tu contraseña de Cuadra',
        texto: [
          'Pediste restablecer tu contraseña de Cuadra.',
          '',
          `Abre este enlace para elegir una nueva. Sirve una sola vez y vence en ${VIGENCIA_HORAS} hora:`,
          `${origen}/recuperar/${token}`,
          '',
          'Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.',
        ].join('\n'),
      });
    } catch (error) {
      // Nunca el mensaje ni el enlace: solo que falló y por qué.
      this.logger.error(
        `No se pudo enviar el enlace de recuperación de la cuenta ${cuenta.id}: ${(error as Error).message}`,
      );
    }
  }

  private async guardar(userId: string, token: string): Promise<void> {
    const qr: QueryRunner = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(
        `UPDATE tokens_recuperacion SET reemplazada_en = now(), updated_at = now()
          WHERE user_id = $1 AND consumida_en IS NULL AND reemplazada_en IS NULL`,
        [userId],
      );
      await qr.query(
        `INSERT INTO tokens_recuperacion (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(hours => $3))`,
        [userId, huellaDeToken(token), VIGENCIA_HORAS],
      );
      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  async consultar(token: string): Promise<EstadoRecuperacionDto> {
    const [fila] = await this.ds.query<FilaToken[]>(SQL_TOKEN, [
      huellaDeToken(token),
    ]);
    if (!fila) return { estado: 'invalida', motivo: 'desconocida' };
    const motivo = motivoInvalido(fila);
    return motivo
      ? { estado: 'invalida', motivo }
      : { estado: 'vigente', motivo: null };
  }

  /**
   * Una sola transacción: bloquea el enlace, cambia la contraseña, lo
   * consume y borra todas las sesiones de la cuenta. No abre sesión: la
   * persona entra por el login. Dos envíos simultáneos se serializan en el
   * bloqueo y el segundo ve el enlace ya usado.
   */
  async restablecer(token: string, password: unknown): Promise<void> {
    exigirPasswordValida(password);
    const hash = await this.hasher.hashear(password as string);

    const qr: QueryRunner = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      const [fila] = (await qr.query(`${SQL_TOKEN} FOR UPDATE`, [
        huellaDeToken(token),
      ])) as FilaToken[];
      if (!fila) return rechazar('desconocida');
      const motivo = motivoInvalido(fila);
      if (motivo) return rechazar(motivo);

      if (fila.userId) {
        await this.restablecerEmpresa(qr, fila.userId, hash);
      } else if (fila.plataformaUsuarioId) {
        const ok = await this.plataforma.restablecer(
          qr,
          fila.plataformaUsuarioId,
          hash,
        );
        if (!ok) throw new ForbiddenException('La cuenta está desactivada.');
      }
      await qr.query(
        `UPDATE tokens_recuperacion SET consumida_en = now(), updated_at = now() WHERE id = $1`,
        [fila.id],
      );
      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  private async restablecerEmpresa(
    qr: QueryRunner,
    userId: string,
    hash: string,
  ): Promise<void> {
    // SELECT y luego UPDATE: el UPDATE ... RETURNING de TypeORM no devuelve
    // solo las filas y no sirve para saber si hubo alguna.
    const activas = (await qr.query(
      `SELECT id FROM users WHERE id = $1 AND activo FOR UPDATE`,
      [userId],
    )) as Array<{ id: string }>;
    if (activas.length === 0) {
      throw new ForbiddenException('La cuenta está desactivada.');
    }
    await qr.query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [userId, hash],
    );
    await qr.query(`DELETE FROM sesiones WHERE user_id = $1`, [userId]);
    // Una fila de bitácora por empresa donde la persona tiene rol, con el
    // contexto de empresa fijado para que la política de `bitacora` deje
    // escribir. Nunca el token ni la contraseña.
    const empresas = (await qr.query(
      `SELECT DISTINCT company_id AS "companyId" FROM user_company_roles WHERE user_id = $1`,
      [userId],
    )) as Array<{ companyId: string }>;
    for (const { companyId } of empresas) {
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        companyId,
      ]);
      await qr.query(
        `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         VALUES ($1, $2, 'users', $2, 'actualizar', $3::jsonb)`,
        [companyId, userId, JSON.stringify({ campo: 'password_hash' })],
      );
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
