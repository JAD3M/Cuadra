import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import type { UserCompanyRole } from '../companies/user-company-role.entity';
import type { Rol } from '../common/entities/tipos';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password';

/**
 * Unitarias: repositorios simulados, hasher y JwtService reales. El
 * JwtService se arma con el mismo default que AuthModule ('5m') para que los
 * tests de duración prueben que cada firma pasa la suya.
 */

const PASSWORD = 'correcta-123';
const EMPRESA_A = {
  id: 'empresa-a',
  razonSocial: 'Alfa SA de CV',
  rfc: 'ALF190101AB1',
};
const EMPRESA_B = {
  id: 'empresa-b',
  razonSocial: 'Beta SA de CV',
  rfc: 'BET190101CD2',
};

let service: AuthService;
let jwt: JwtService;
let usuario: User;
const buscarUsuario = jest.fn();
const buscarRoles = jest.fn();

beforeAll(async () => {
  usuario = {
    id: 'usuario-1',
    email: 'persona@ejemplo.mx',
    nombre: 'Persona',
    passwordHash: await new PasswordHasher().hashear(PASSWORD),
    activo: true,
  } as User;
});

beforeEach(async () => {
  buscarUsuario.mockReset();
  buscarRoles.mockReset();
  jwt = new JwtService({
    secret: 'secreto-de-pruebas-unitarias',
    signOptions: { expiresIn: '5m' },
  });
  service = new AuthService(
    { findOne: buscarUsuario } as unknown as Repository<User>,
    { find: buscarRoles } as unknown as Repository<UserCompanyRole>,
    new PasswordHasher(),
    jwt,
  );
  await service.onModuleInit();
});

function filaRol(empresa: typeof EMPRESA_A, rol: Rol) {
  return { companyId: empresa.id, rol, company: empresa };
}

function duracion(token: string): number {
  const { exp, iat } = jwt.decode<{ exp: number; iat: number }>(token);
  return exp - iat;
}

describe('AuthService.login', () => {
  it('email inexistente y contraseña mala dan el mismo 401', async () => {
    buscarUsuario.mockResolvedValueOnce(null);
    const inexistente = await service
      .login('nadie@ejemplo.mx', PASSWORD)
      .catch((e: unknown) => e);

    buscarUsuario.mockResolvedValueOnce(usuario);
    const malaPassword = await service
      .login(usuario.email, 'incorrecta')
      .catch((e: unknown) => e);

    expect(inexistente).toBeInstanceOf(UnauthorizedException);
    expect(malaPassword).toBeInstanceOf(UnauthorizedException);
    expect((inexistente as Error).message).toBe(
      (malaPassword as Error).message,
    );
  });

  it('sin membresías da 403, no 401', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([]);

    await expect(service.login(usuario.email, PASSWORD)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deduplica empresas cuando hay varios roles en la misma (D-08)', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([
      filaRol(EMPRESA_A, 'contador'),
      filaRol(EMPRESA_A, 'revisor'),
      filaRol(EMPRESA_B, 'admin'),
    ]);

    const { empresas } = await service.login(usuario.email, PASSWORD);

    expect(empresas).toEqual([
      { ...EMPRESA_A, roles: ['contador', 'revisor'] },
      { ...EMPRESA_B, roles: ['admin'] },
    ]);
  });

  it('ordena los roles admin, contador, revisor aunque la base los dé al revés', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([
      filaRol(EMPRESA_A, 'revisor'),
      filaRol(EMPRESA_A, 'contador'),
      filaRol(EMPRESA_A, 'admin'),
    ]);

    const { empresas } = await service.login(usuario.email, PASSWORD);

    expect(empresas).toEqual([
      { ...EMPRESA_A, roles: ['admin', 'contador', 'revisor'] },
    ]);
  });

  it('devuelve usuario con solo id, nombre y email, sin passwordHash', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([filaRol(EMPRESA_A, 'admin')]);

    const respuesta = await service.login(usuario.email, PASSWORD);

    expect(respuesta.usuario).toEqual({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
    });
    expect(respuesta.usuario).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(respuesta)).not.toContain(usuario.passwordHash);
  });

  it('con credenciales malas no consulta membresías', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);

    await expect(service.login(usuario.email, 'incorrecta')).rejects.toThrow(
      'Credenciales inválidas',
    );

    expect(buscarRoles).not.toHaveBeenCalled();
  });

  it('no registra el email ni el nombre en logs', async () => {
    const espias = [
      jest.spyOn(Logger.prototype, 'log'),
      jest.spyOn(Logger.prototype, 'warn'),
      jest.spyOn(Logger.prototype, 'error'),
      jest.spyOn(Logger.prototype, 'debug'),
      jest.spyOn(console, 'log'),
    ];
    try {
      buscarUsuario.mockResolvedValueOnce(usuario);
      buscarRoles.mockResolvedValueOnce([filaRol(EMPRESA_A, 'admin')]);
      await service.login(usuario.email, PASSWORD);

      const registrado = JSON.stringify(espias.flatMap((e) => e.mock.calls));
      expect(registrado).not.toContain(usuario.email);
      expect(registrado).not.toContain(usuario.nombre);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('firma un token de selección de 300 s con solo sub y scope', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([filaRol(EMPRESA_A, 'admin')]);

    const { token } = await service.login(usuario.email, PASSWORD);
    const payload = jwt.decode<Record<string, unknown>>(token);

    expect(duracion(token)).toBe(300);
    expect(payload).toMatchObject({ sub: usuario.id, scope: 'seleccion' });
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('roles');
  });
});

describe('AuthService.seleccionarEmpresa', () => {
  it('firma un token de sesión de 900 s con la empresa', async () => {
    buscarRoles.mockResolvedValueOnce([{ rol: 'contador' }]);

    const { token } = await service.seleccionarEmpresa(
      usuario.id,
      EMPRESA_A.id,
    );
    const payload = jwt.decode<Record<string, unknown>>(token);

    expect(duracion(token)).toBe(900);
    expect(payload).toMatchObject({
      sub: usuario.id,
      scope: 'sesion',
      companyId: EMPRESA_A.id,
    });
    expect(payload).not.toHaveProperty('roles');
  });

  it('da 403 si no tiene roles en esa empresa', async () => {
    buscarRoles.mockResolvedValueOnce([]);

    await expect(
      service.seleccionarEmpresa(usuario.id, EMPRESA_B.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('consulta los roles filtrando por usuario, empresa y vigencia', async () => {
    buscarRoles.mockResolvedValueOnce([{ rol: 'admin' }]);

    await service.seleccionarEmpresa(usuario.id, EMPRESA_A.id);

    expect(buscarRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: usuario.id,
          companyId: EMPRESA_A.id,
          company: { activa: true },
          user: { activo: true },
        },
      }),
    );
  });
});
