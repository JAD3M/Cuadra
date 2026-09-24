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
import { JwtService } from '@nestjs/jwt';
import { UserCompanyRole } from '../companies/user-company-role.entity';
import { EmpresaDisponible, JwtPayload } from './tipos';
import type { Rol } from '../common/entities/tipos';
import { normalizarEmail } from '../users/email';
import { RespuestaLoginDto, RespuestaTokenDto } from './dto/respuestas.dto';

/** D-09. Cada firma pasa la suya; el default del módulo es solo la red. */
const DURACION_SELECCION = '5m';
const DURACION_SESION = '15m';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserCompanyRole)
    private readonly userCompanyRoleRepository: Repository<UserCompanyRole>,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
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
      order: {
        company: { razonSocial: 'ASC' },
      },
    });
    const empresasMap = new Map<string, EmpresaDisponible>();
    filas.forEach((fila) => {
      empresasMap.set(fila.company.id, {
        id: fila.company.id,
        razonSocial: fila.company.razonSocial,
      });
    });
    return Array.from(empresasMap.values());
  }

  /** Paso 1 de D-09: credenciales → token de selección + empresas para elegir. */
  async login(email: string, password: string): Promise<RespuestaLoginDto> {
    const user = await this.validarCredenciales(email, password);
    const empresas = await this.consultarCompanies(user.id);
    if (empresas.length === 0) {
      // Las credenciales eran correctas: no es un 401.
      throw new ForbiddenException('El usuario no tiene empresas asignadas');
    }
    const token = await this.firmar(
      { sub: user.id, scope: 'seleccion' },
      DURACION_SELECCION,
    );
    return { token, empresas };
  }

  /**
   * Paso 2 de D-09: canjea el token de selección por uno de sesión. El
   * `companyId` viene del cliente, así que se valida contra la base antes
   * de firmarlo.
   */
  async seleccionarEmpresa(
    userId: string,
    companyId: string,
  ): Promise<RespuestaTokenDto> {
    const roles = await this.rolesEnEmpresa(userId, companyId);
    if (roles.length === 0) {
      throw new ForbiddenException('Sin acceso a esta empresa');
    }
    const token = await this.firmar(
      { sub: userId, scope: 'sesion', companyId },
      DURACION_SESION,
    );
    return { token };
  }

  /**
   * Roles vigentes del usuario en una empresa, leídos en cada request
   * (D-09): revocar un rol, desactivar al usuario o a la empresa surte
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

  /** Único punto de firma: la duración es obligatoria, nunca se omite. */
  private firmar(
    payload: JwtPayload,
    expiresIn: typeof DURACION_SELECCION | typeof DURACION_SESION,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn });
  }
}
