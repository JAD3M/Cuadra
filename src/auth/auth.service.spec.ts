import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import type { UserCompanyRole } from '../companies/user-company-role.entity';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password';

/**
 * Unitarias: repositorios simulados, hasher y JwtService reales. El
 * JwtService se arma con el mismo default que AuthModule ('5m') para que los
 * tests de duración prueben que cada firma pasa la suya.
 */

const PASSWORD = 'correcta-123';
const EMPRESA_A = { id: 'empresa-a', razonSocial: 'Alfa SA de CV' };
const EMPRESA_B = { id: 'empresa-b', razonSocial: 'Beta SA de CV' };

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

function filaRol(empresa: typeof EMPRESA_A, rol: string) {
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

    expect(empresas).toEqual([EMPRESA_A, EMPRESA_B]);
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
