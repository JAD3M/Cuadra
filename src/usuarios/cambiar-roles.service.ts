import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ROLES, type Rol } from '../common/entities/tipos';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { UsuarioRolesDto } from './dto/usuarios.dto';

export const MENSAJE_ULTIMO_ADMIN =
  'No se puede quitar ni degradar al único administrador. Asigna el rol de administrador a otra persona primero.';

interface Bloqueo {
  actuales: Rol[];
  email: string;
}

/** En el orden de `ROLES`, para comparar conjuntos y guardar en la bitácora. */
const ordenar = (roles: readonly Rol[]): Rol[] =>
  ROLES.filter((r) => roles.includes(r));

/**
 * Historia 2.6 (FR-45, FR-46). Una persona administradora reemplaza los roles
 * de alguien de su equipo o le quita el acceso a la empresa.
 *
 * `user_company_roles` y `sesiones` son clase 2 (sin RLS): la empresa se
 * impone con `company_id = $1` explícito, con el valor de la sesión. Todo
 * corre en la transacción de la petición: se toma un candado de la empresa
 * (`pg_advisory_xact_lock`) antes de leer, así que dos cambios simultáneos
 * se serializan y el segundo ve el resultado del primero. Eso evita que dos
 * admins se quiten entre sí y dejen la empresa sin ninguno. La bitácora y el
 * cierre de sesiones confirman junto con el cambio.
 *
 * Una persona sin roles en esta empresa, o que no existe, es 404: no se
 * revela si existe en otra.
 */
@Injectable()
export class CambiarRolesService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async cambiar(
    companyId: string,
    actorId: string,
    id: string,
    nuevos: Rol[],
  ): Promise<UsuarioRolesDto> {
    const manager = this.contexto.manager();
    const despues = ordenar(nuevos);
    const { actuales, email } = await this.bloquear(manager, companyId, id);
    const iguales =
      actuales.length === despues.length &&
      actuales.every((r, i) => r === despues[i]);
    // El mismo conjunto no es un cambio: no se escribe ni se registra.
    if (iguales) return { id, email, roles: actuales };

    await this.exigirOtroAdmin(manager, companyId, id, actuales, despues);
    const sobran = actuales.filter((r) => !despues.includes(r));
    const faltan = despues.filter((r) => !actuales.includes(r));
    if (sobran.length > 0) {
      await manager.query(
        `DELETE FROM user_company_roles
          WHERE user_id = $1 AND company_id = $2 AND rol = ANY($3)`,
        [id, companyId, sobran],
      );
    }
    for (const rol of faltan) {
      await manager.query(
        `INSERT INTO user_company_roles (user_id, company_id, rol)
         VALUES ($1, $2, $3)`,
        [id, companyId, rol],
      );
    }
    await this.registrar(manager, companyId, actorId, 'cambiar_rol', {
      usuarioId: id,
      email,
      antes: actuales,
      despues,
    });
    return { id, email, roles: despues };
  }

  async quitar(
    companyId: string,
    actorId: string,
    id: string,
  ): Promise<UsuarioRolesDto> {
    const manager = this.contexto.manager();
    const { actuales, email } = await this.bloquear(manager, companyId, id);
    await this.exigirOtroAdmin(manager, companyId, id, actuales, []);

    await manager.query(
      `DELETE FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [id, companyId],
    );
    // Una sesión tiene una sola empresa elegida: solo mueren las elegidas en
    // esta. Las de otras empresas y las aún sin empresa siguen sirviendo.
    await manager.query(
      `DELETE FROM sesiones WHERE user_id = $1 AND company_id = $2`,
      [id, companyId],
    );
    await this.registrar(manager, companyId, actorId, 'quitar_rol', {
      usuarioId: id,
      email,
      roles: actuales,
    });
    return { id, email, roles: [] };
  }

  /**
   * Serializa los cambios de roles de la empresa y lee los de la persona. Sin
   * roles aquí: 404. `cuadra_app` no tiene UPDATE sobre `user_company_roles`
   * (la migración solo le da DELETE), y `FOR UPDATE` lo exige; por eso el
   * candado es un `pg_advisory_xact_lock` por empresa, que se suelta solo al
   * terminar la transacción. En READ COMMITTED las lecturas siguientes ya ven
   * lo que confirmó quien tenía el candado antes.
   */
  private async bloquear(
    manager: EntityManager,
    companyId: string,
    id: string,
  ): Promise<Bloqueo> {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('roles:' || $1::text, 0))`,
      [companyId],
    );
    const filas = await manager.query<Array<{ rol: Rol; email: string }>>(
      `SELECT r.rol, u.email
         FROM user_company_roles r
         JOIN users u ON u.id = r.user_id
        WHERE r.user_id = $1 AND r.company_id = $2`,
      [id, companyId],
    );
    if (filas.length === 0) {
      throw new NotFoundException('La persona no existe en esta empresa.');
    }
    return {
      actuales: ordenar(filas.map((f) => f.rol)),
      email: filas[0].email,
    };
  }

  /** FR-46: si la persona es admin y deja de serlo, tiene que quedar otro. */
  private async exigirOtroAdmin(
    manager: EntityManager,
    companyId: string,
    id: string,
    actuales: Rol[],
    despues: Rol[],
  ): Promise<void> {
    if (!actuales.includes('admin') || despues.includes('admin')) return;
    const [{ otros }] = await manager.query<Array<{ otros: number }>>(
      `SELECT count(*)::int AS otros FROM user_company_roles
        WHERE company_id = $1 AND rol = 'admin' AND user_id <> $2`,
      [companyId, id],
    );
    if (otros === 0) throw new ConflictException(MENSAJE_ULTIMO_ADMIN);
  }

  private async registrar(
    manager: EntityManager,
    companyId: string,
    actorId: string,
    accion: 'cambiar_rol' | 'quitar_rol',
    datos: Record<string, unknown>,
  ): Promise<void> {
    // Igual que invitar: `entidad` es la empresa; la persona va en `datos`.
    await manager.query(
      `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
       VALUES ($1, $2, 'companies', $1, $3, $4::jsonb)`,
      [companyId, actorId, accion, JSON.stringify(datos)],
    );
  }
}
