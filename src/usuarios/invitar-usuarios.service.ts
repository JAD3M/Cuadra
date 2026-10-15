import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { huellaDeToken, nuevoToken } from '../auth/sesiones.service';
import type { Rol } from '../common/entities/tipos';
import { ProveedorCorreo } from '../correo/proveedor-correo';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { InvitacionUsuarioEnviadaDto } from './dto/usuarios.dto';

/** SQLSTATE de `unique_violation`. */
const VIOLACION_UNICA = '23505';

/** Vigencia del enlace (decisión de la historia 1.5). */
const VIGENCIA_DIAS = 7;

/**
 * Historia 2.3 (FR-41, FR-50). Una persona administradora invita a su gente.
 * No ramifica por la existencia de la cuenta: siempre reemplaza la invitación
 * viva, crea la nueva y manda el correo, así la respuesta (y los errores) no
 * revelan quién tiene cuenta.
 *
 * Todo corre en la transacción de la petición (empresa fijada por RLS):
 * la invitación y la fila de bitácora confirman juntas o no queda ninguna. El
 * correo sale después del COMMIT y el token en claro solo existe en ese
 * mensaje: nunca se guarda ni se registra.
 */
@Injectable()
export class InvitarUsuariosService {
  private readonly logger = new Logger(InvitarUsuariosService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly correo: ProveedorCorreo,
    private readonly config: ConfigService,
  ) {}

  async invitar(
    companyId: string,
    invitadorId: string,
    email: string,
    roles: Rol[],
  ): Promise<InvitacionUsuarioEnviadaDto> {
    const manager = this.contexto.manager();
    const token = nuevoToken();
    const [empresa] = await manager.query<Array<{ razonSocial: string }>>(
      `SELECT razon_social AS "razonSocial" FROM companies WHERE id = $1`,
      [companyId],
    );

    await manager.query('SAVEPOINT invitar_usuario');
    try {
      await this.guardar(manager, companyId, invitadorId, email, roles, token);
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      // Otra invitación al mismo correo ganó la carrera por la viva: se
      // reintenta una vez, ya reemplazándola.
      await manager.query('ROLLBACK TO SAVEPOINT invitar_usuario');
      await this.guardar(manager, companyId, invitadorId, email, roles, token);
    }
    await manager.query('RELEASE SAVEPOINT invitar_usuario');

    this.contexto.alConfirmar(() =>
      this.enviar(companyId, empresa.razonSocial, email, roles, token),
    );
    return { email, roles };
  }

  private async guardar(
    manager: EntityManager,
    companyId: string,
    invitadorId: string,
    email: string,
    roles: Rol[],
    token: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE invitaciones SET reemplazada_en = now(), updated_at = now()
        WHERE company_id = $1 AND email = $2
          AND consumida_en IS NULL AND reemplazada_en IS NULL`,
      [companyId, email],
    );
    const [invitacion] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO invitaciones
         (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
       VALUES ($1, $2, $3::text[], $4, now() + make_interval(days => $5), $6)
       RETURNING id`,
      [
        companyId,
        email,
        roles,
        huellaDeToken(token),
        VIGENCIA_DIAS,
        invitadorId,
      ],
    );
    await manager.query(
      `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
       VALUES ($1, $2, 'companies', $1, 'invitar', $3::jsonb)`,
      [
        companyId,
        invitadorId,
        JSON.stringify({ invitacionId: invitacion.id, email, roles }),
      ],
    );
  }

  private async enviar(
    companyId: string,
    razonSocial: string,
    email: string,
    roles: Rol[],
    token: string,
  ): Promise<void> {
    const origen = this.config.getOrThrow<string>('ORIGEN_AUTORIZADO');
    try {
      await this.correo.enviar({
        para: email,
        asunto: `Invitación para unirte a ${razonSocial} en Cuadra`,
        texto: [
          `Te invitaron a ${razonSocial} en Cuadra con ${roles.length === 1 ? 'el rol' : 'los roles'}: ${roles.join(', ')}.`,
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
  }
}

function esViolacionUnica(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === VIOLACION_UNICA
  );
}
