import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordHasher } from './password';
import { User } from '../users/user.entity';
import { Raw, Repository } from 'typeorm';
import {
  UnauthorizedException,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserCompanyRole } from '../companies/user-company-role.entity';
import { SesionesService } from './sesiones.service';
import type {
  ContextoSesion,
  EmpresaDisponible,
  ResultadoLogin,
} from './tipos';
import { ROLES, type Rol } from '../common/entities/tipos';
import { normalizarEmail } from '../users/email';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserCompanyRole)
    private readonly userCompanyRoleRepository: Repository<UserCompanyRole>,
    private readonly passwordHasher: PasswordHasher,
    private readonly sesiones: SesionesService,
  ) {}
  hashFalso!: string;
  async onModuleInit() {
    this.hashFalso = await this.passwordHasher.hashear(
      randomBytes(32).toString('hex'),
    );
  }
  async validarCredenciales(email: string, password: string): Promise<User> {
    // lower(email) y no email a secas: es lo que usa el índice único
    // ux_users_email_lower.
    const user = await this.userRepository.findOne({
      where: {
        email: Raw((columna) => `lower(${columna}) = :email`, {
          email: normalizarEmail(email),
        }),
      },
    });
    const comparation = !user ? this.hashFalso : user.passwordHash;
    const passwordValida = await this.passwordHasher.verificar(
      password,
      comparation,
    );
    if (!user || !user.activo || !passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
  async consultarCompanies(userId: string): Promise<EmpresaDisponible[]> {
    const filas = await this.userCompanyRoleRepository.find({
      where: {
        userId,
        company: { activa: true },
        user: { activo: true },
      },
      relations: {
        company: true,
      },
      // El id desempata razones sociales iguales para que el orden no varíe.
      order: {
        company: { razonSocial: 'ASC', id: 'ASC' },
      },
    });
    const empresasMap = new Map<string, EmpresaDisponible>();
    filas.forEach((fila) => {
      const empresa = empresasMap.get(fila.company.id) ?? {
        id: fila.company.id,
        razonSocial: fila.company.razonSocial,
        rfc: fila.company.rfc,
        roles: [],
      };
      empresa.roles.push(fila.rol);
      empresasMap.set(fila.company.id, empresa);
    });
    return Array.from(empresasMap.values()).map((empresa) => ({
      ...empresa,
      roles: this.ordenarRoles(empresa.roles),
    }));
  }

  /** Orden fijo de ROLES (admin, contador, revisor), sin repetidos. */
  private ordenarRoles(roles: Rol[]): Rol[] {
    return ROLES.filter((rol) => roles.includes(rol));
  }

  /**
   * Paso 1 (AD-6): valida credenciales y abre una sesión sin empresa elegida.
   * El token solo sale para que el controlador lo ponga en la cookie.
   */
  async login(email: string, password: string): Promise<ResultadoLogin> {
    const user = await this.validarCredenciales(email, password);
    const empresas = await this.consultarCompanies(user.id);
    if (empresas.length === 0) {
      // Las credenciales eran correctas: no es un 401.
      throw new ForbiddenException('El usuario no tiene empresas asignadas');
    }
    const { token } = await this.sesiones.crear(user.id, 'empresa');
    return {
      token,
      usuario: { id: user.id, nombre: user.nombre, email: user.email },
      empresas,
    };
  }

  /**
   * Paso 2 (AD-6): la misma fila de `sesiones` gana la empresa y el token
   * rota. El `companyId` viene del cliente, así que se valida contra la base
   * antes de tocar la sesión: un 403 la deja como estaba. Devuelve el token
   * nuevo para la cookie.
   */
  async seleccionarEmpresa(
    userId: string,
    sesionId: string,
    companyId: string,
  ): Promise<string> {
    const roles = await this.rolesEnEmpresa(userId, companyId);
    if (roles.length === 0) {
      throw new ForbiddenException('Sin acceso a esta empresa');
    }
    const token = await this.sesiones.elegirEmpresa(sesionId, companyId);
    if (token === null) throw new UnauthorizedException('No autorizado');
    return token;
  }

  /**
   * Roles vigentes del usuario en una empresa, leídos en cada request
   * (AD-6): revocar un rol, desactivar al usuario o a la empresa surte
   * efecto de inmediato. Vacío = sin acceso.
   */
  async rolesEnEmpresa(userId: string, companyId: string): Promise<Rol[]> {
    const filas = await this.userCompanyRoleRepository.find({
      select: { rol: true },
      where: {
        userId,
        companyId,
        company: { activa: true },
        user: { activo: true },
      },
    });
    return filas.map((fila) => fila.rol);
  }

  /**
   * Quién es el usuario de la sesión, en qué empresa y con qué roles. Todo se
   * lee de la base en cada llamada (AD-6); el `companyId` viene solo de la
   * fila de `sesiones` y el predicado es el mismo de `rolesEnEmpresa`.
   */
  async contexto(userId: string, companyId: string): Promise<ContextoSesion> {
    // `select` anidado: el hash de la contraseña ni siquiera se hidrata.
    const filas = await this.userCompanyRoleRepository.find({
      select: {
        rol: true,
        user: { id: true, nombre: true, email: true },
        company: { id: true, razonSocial: true, rfc: true },
      },
      relations: { user: true, company: true },
      where: {
        userId,
        companyId,
        company: { activa: true },
        user: { activo: true },
      },
    });
    if (filas.length === 0) {
      throw new ForbiddenException('Sin acceso a esta empresa');
    }
    const { user, company } = filas[0];
    return {
      usuario: { id: user.id, nombre: user.nombre, email: user.email },
      empresa: {
        id: company.id,
        razonSocial: company.razonSocial,
        rfc: company.rfc,
      },
      roles: this.ordenarRoles(filas.map((fila) => fila.rol)),
    };
  }
}
