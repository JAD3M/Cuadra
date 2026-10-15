import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import { huellaDeToken, SesionesService } from '../auth/sesiones.service';
import { exigirPasswordValida } from '../common/politica-contrasena';
import type {
  EstadoInvitacionDto,
  InvitacionAceptadaDto,
  MotivoInvitacionInvalida,
} from './dto/invitaciones.dto';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

const MENSAJES: Record<MotivoInvitacionInvalida, string> = {
  usada: 'Esta invitación ya se usó.',
  caducada: 'Esta invitación venció. Pide que te inviten de nuevo.',
  reemplazada:
    'Esta invitación fue reemplazada por una más reciente. Usa el enlace del correo nuevo.',
  desconocida: 'El enlace de invitación no es válido.',
};

interface FilaInvitacion {
  id: string;
  companyId: string;
  email: string;
  roles: string[];
  razonSocial: string;
  consumida: boolean;
  reemplazada: boolean;
  caducada: boolean;
}

const SQL_INVITACION = `
  SELECT i.id, i.company_id AS "companyId", i.email, i.roles,
         c.razon_social AS "razonSocial",
         i.consumida_en IS NOT NULL AS consumida,
         i.reemplazada_en IS NOT NULL AS reemplazada,
         i.expires_at <= now() AS caducada
    FROM invitaciones i
    JOIN companies c ON c.id = i.company_id
   WHERE i.token_hash = $1`;

function motivoInvalido(fila: FilaInvitacion): MotivoInvitacionInvalida | null {
  if (fila.consumida) return 'usada';
  if (fila.reemplazada) return 'reemplazada';
  if (fila.caducada) return 'caducada';
  return null;
}

function rechazar(motivo: MotivoInvitacionInvalida): never {
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
 * Historia 1.5 (FR-40, AD-14). Consultar y aceptar el enlace de invitación,
 * sin sesión. El token solo se compara por su SHA-256. `invitaciones`,
 * `users` y `user_company_roles` son identidad (sin RLS); SQL explícito
 * porque `cuadra_app` solo tiene INSERT por columna sobre `users` y roles.
 */
@Injectable()
export class InvitacionesService {
  constructor(
    private readonly ds: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly sesiones: SesionesService,
  ) {}

  async consultar(token: string): Promise<EstadoInvitacionDto> {
    const [fila] = await this.ds.query<FilaInvitacion[]>(SQL_INVITACION, [
      huellaDeToken(token),
    ]);
    if (!fila) return invalida('desconocida');
    const motivo = motivoInvalido(fila);
    if (motivo) return invalida(motivo);
    const cuenta = await this.ds.query<unknown[]>(
      `SELECT 1 FROM users WHERE lower(email) = $1`,
      [fila.email],
    );
    return {
      estado: 'vigente',
      motivo: null,
      empresa: fila.razonSocial,
      requierePassword: cuenta.length === 0,
    };
  }

  /**
   * Una sola transacción: bloquea la invitación, crea la cuenta o reutiliza
   * la existente (sin tocar su contraseña), da todos los roles de la invitación y consume el enlace.
   * La sesión se abre después del commit. Dos aceptaciones simultáneas se
   * serializan en el bloqueo y la segunda ve el enlace ya usado.
   */
  async aceptar(
    token: string,
    entrada: { password?: string; nombre?: string },
  ): Promise<{
    resultado: InvitacionAceptadaDto;
    token: string;
  }> {
    const qr: QueryRunner = this.ds.createQueryRunner();
    await qr.connect();
    let companyId: string;
    let razonSocial: string;
    let userId: string;
    let cuentaNueva = false;
    try {
      await qr.startTransaction();
      const [fila] = (await qr.query(`${SQL_INVITACION} FOR UPDATE OF i`, [
        huellaDeToken(token),
      ])) as FilaInvitacion[];
      if (!fila) return rechazar('desconocida');
      const motivo = motivoInvalido(fila);
      if (motivo) return rechazar(motivo);

      const [existente] = (await qr.query(
        `SELECT id, activo FROM users WHERE lower(email) = $1`,
        [fila.email],
      )) as Array<{ id: string; activo: boolean }>;

      if (existente) {
        if (!existente.activo) {
          throw new ForbiddenException('La cuenta está desactivada.');
        }
        // Cuenta existente: ni se lee ni se cambia su contraseña.
        userId = existente.id;
      } else {
        const { password, nombre } = entrada;
        if (!nombre || nombre.length === 0) {
          throw new BadRequestException('Escribe tu nombre.');
        }
        exigirPasswordValida(password);
        const [creado] = (await qr.query(
          `INSERT INTO users (email, nombre, password_hash) VALUES ($1, $2, $3) RETURNING id`,
          [fila.email, nombre, await this.hasher.hashear(password as string)],
        )) as Array<{ id: string }>;
        userId = creado.id;
        cuentaNueva = true;
      }

      await qr.query(
        `INSERT INTO user_company_roles (user_id, company_id, rol)
         SELECT $1::uuid, $2::uuid, r.rol FROM unnest($3::text[]) AS r(rol)
         ON CONFLICT (user_id, company_id, rol) DO NOTHING`,
        [userId, fila.companyId, fila.roles],
      );
      await qr.query(
        `UPDATE invitaciones SET consumida_en = now(), updated_at = now() WHERE id = $1`,
        [fila.id],
      );
      await qr.commitTransaction();
      companyId = fila.companyId;
      razonSocial = fila.razonSocial;
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      // Alguien creó la cuenta entre la lectura y el INSERT: que reintente.
      if (esViolacionUnica(error)) {
        throw new ConflictException(
          'No se pudo completar la invitación. Inténtalo de nuevo.',
        );
      }
      throw error;
    } finally {
      await qr.release();
    }

    const { token: sesion } = await this.sesiones.crear(
      userId,
      'empresa',
      companyId,
    );
    return {
      resultado: { companyId, razonSocial, cuentaNueva },
      token: sesion,
    };
  }
}

function invalida(motivo: MotivoInvitacionInvalida): EstadoInvitacionDto {
  return { estado: 'invalida', motivo, empresa: null, requierePassword: null };
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
