import { Injectable, Logger } from '@nestjs/common';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import type { Rol } from '../common/entities/tipos';
import type { PermisoEmpresa } from '../auth/permisos/matriz';
import { Bitacora } from './bitacora.entity';

export interface AccesoDenegado {
  /** Empresa del token de sesión: firmada por nosotros, no viene del cliente. */
  companyId: string;
  userId: string;
  metodo: string;
  ruta: string;
  /** Los roles que tienen el permiso; vacío si solo exigía membresía. */
  rolesRequeridos: Rol[];
  /** FR-55: el permiso de la matriz que faltó; nulo si solo exigía membresía. */
  permiso?: PermisoEmpresa;
  /** Vacío si ya no es miembro de la empresa. */
  rolesDelUsuario: Rol[];
  ip?: string;
  userAgent?: string;
}

/**
 * CU-03.3: deja en la bitácora de la empresa cada 403 de `RolesGuard`.
 *
 * Los guards corren antes que `TransaccionEmpresaInterceptor`, así que aquí
 * no hay transacción de la petición: se abre una propia con la empresa del
 * token fijada, y la política RLS de `bitacora` acepta el INSERT.
 *
 * Nunca lanza: si la bitácora falla, el usuario recibe su 403 igual y el
 * error queda en el log.
 */
@Injectable()
export class AccesosDenegados {
  private readonly logger = new Logger(AccesosDenegados.name);

  constructor(private readonly transaccion: TransaccionEmpresa) {}

  async registrar(acceso: AccesoDenegado): Promise<void> {
    try {
      await this.transaccion.ejecutar(acceso.companyId, (manager) =>
        manager.insert(Bitacora, {
          companyId: acceso.companyId,
          userId: acceso.userId,
          entidad: 'companies',
          entidadId: acceso.companyId,
          accion: 'acceso_denegado',
          datos: {
            metodo: acceso.metodo,
            ruta: acceso.ruta,
            motivo:
              acceso.rolesDelUsuario.length === 0
                ? 'sin_membresia'
                : 'rol_insuficiente',
            ...(acceso.permiso === undefined
              ? {}
              : { permiso: acceso.permiso }),
            rolesRequeridos: acceso.rolesRequeridos,
            rolesDelUsuario: acceso.rolesDelUsuario,
          },
          ip: acceso.ip ?? null,
          userAgent: acceso.userAgent ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el acceso denegado de ${acceso.userId} en ${acceso.companyId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
