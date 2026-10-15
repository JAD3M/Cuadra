import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import type { UserCompanyRole } from '../companies/user-company-role.entity';
import type { Rol } from '../common/entities/tipos';
import { AuthService } from './auth.service';
import { permisosDeRoles } from './permisos/matriz';
import { PasswordHasher } from './password';
import type { SesionesService } from './sesiones.service';

/**
 * Unitarias: repositorios y servicio de sesiones simulados, hasher real. La
 * sesión con cookie la prueba de punta a punta auth.integracion.spec.
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
let usuario: User;
const buscarUsuario = jest.fn();
const buscarRoles = jest.fn();
const crearSesion = jest.fn();
const elegirEmpresa = jest.fn();

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
  crearSesion.mockReset().mockResolvedValue({ token: 'token-nuevo' });
  elegirEmpresa.mockReset().mockResolvedValue('token-rotado');
  service = new AuthService(
    { findOne: buscarUsuario } as unknown as Repository<User>,
    { find: buscarRoles } as unknown as Repository<UserCompanyRole>,
    new PasswordHasher(),
    {
      crear: crearSesion,
      elegirEmpresa,
    } as unknown as SesionesService,
  );
  await service.onModuleInit();
});

function filaRol(empresa: typeof EMPRESA_A, rol: Rol) {
  return { companyId: empresa.id, rol, company: empresa };
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

  it('abre una sesión de tipo empresa sin empresa elegida y devuelve su token', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([filaRol(EMPRESA_A, 'admin')]);

    const { token } = await service.login(usuario.email, PASSWORD);

    expect(token).toBe('token-nuevo');
    expect(crearSesion).toHaveBeenCalledWith(usuario.id, 'empresa');
  });

  it('con credenciales malas o sin empresas no abre sesión', async () => {
    buscarUsuario.mockResolvedValueOnce(usuario);
    await service.login(usuario.email, 'incorrecta').catch(() => undefined);
    buscarUsuario.mockResolvedValueOnce(usuario);
    buscarRoles.mockResolvedValueOnce([]);
    await service.login(usuario.email, PASSWORD).catch(() => undefined);

    expect(crearSesion).not.toHaveBeenCalled();
  });
});

describe('AuthService.seleccionarEmpresa', () => {
  it('rota la sesión a la empresa elegida y devuelve el token nuevo', async () => {
    buscarRoles.mockResolvedValueOnce([{ rol: 'contador' }]);

    const token = await service.seleccionarEmpresa(
      usuario.id,
      'sesion-1',
      EMPRESA_A.id,
    );

    expect(token).toBe('token-rotado');
    expect(elegirEmpresa).toHaveBeenCalledWith('sesion-1', EMPRESA_A.id);
  });

  it('da 403 si no tiene roles en esa empresa', async () => {
    buscarRoles.mockResolvedValueOnce([]);

    await expect(
      service.seleccionarEmpresa(usuario.id, 'sesion-1', EMPRESA_B.id),
    ).rejects.toThrow(ForbiddenException);
    // El 403 deja la sesión como estaba.
    expect(elegirEmpresa).not.toHaveBeenCalled();
  });

  it('consulta los roles filtrando por usuario, empresa y vigencia', async () => {
    buscarRoles.mockResolvedValueOnce([{ rol: 'admin' }]);

    await service.seleccionarEmpresa(usuario.id, 'sesion-1', EMPRESA_A.id);

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

describe('AuthService.contexto', () => {
  const user = {
    id: 'usuario-1',
    nombre: 'Persona',
    email: 'persona@ejemplo.mx',
  };
  const fila = (rol: Rol) => ({ rol, user, company: EMPRESA_A });

  it('devuelve usuario, empresa con rfc y roles ordenados', async () => {
    buscarRoles.mockResolvedValueOnce([fila('revisor'), fila('admin')]);

    const contexto = await service.contexto(user.id, EMPRESA_A.id);

    expect(contexto).toEqual({
      usuario: user,
      empresa: EMPRESA_A,
      roles: ['admin', 'revisor'],
      capacidades: permisosDeRoles(['admin', 'revisor']),
    });
    expect(contexto.usuario).not.toHaveProperty('passwordHash');
  });

  it('las capacidades son la unión de la matriz de sus roles, sin permisos del dueño', async () => {
    buscarRoles.mockResolvedValueOnce([fila('auditor')]);

    const contexto = await service.contexto(user.id, EMPRESA_A.id);

    expect(contexto.capacidades).toEqual(['bandeja.ver', 'bitacora.ver']);
  });

  it('filtra por usuario, empresa y vigencia, sin pedir passwordHash', async () => {
    buscarRoles.mockResolvedValueOnce([fila('admin')]);

    await service.contexto(user.id, EMPRESA_A.id);

    const [consulta] = buscarRoles.mock.calls[0] as [
      { select: { user: Record<string, boolean> } },
    ];
    expect(consulta).toMatchObject({
      where: {
        userId: user.id,
        companyId: EMPRESA_A.id,
        company: { activa: true },
        user: { activo: true },
      },
    });
    expect(consulta.select.user).not.toHaveProperty('passwordHash');
  });

  it('da 403 si no hay filas vigentes', async () => {
    buscarRoles.mockResolvedValueOnce([]);

    await expect(service.contexto(user.id, EMPRESA_A.id)).rejects.toThrow(
      new ForbiddenException('Sin acceso a esta empresa'),
    );
  });

  it('no registra el email ni el nombre en logs', async () => {
    const espias = [
      jest.spyOn(Logger.prototype, 'log'),
      jest.spyOn(Logger.prototype, 'warn'),
      jest.spyOn(Logger.prototype, 'error'),
      jest.spyOn(console, 'log'),
    ];
    try {
      buscarRoles.mockResolvedValueOnce([fila('admin')]);
      await service.contexto(user.id, EMPRESA_A.id);

      const registrado = JSON.stringify(espias.flatMap((e) => e.mock.calls));
      expect(registrado).not.toContain(user.email);
      expect(registrado).not.toContain(user.nombre);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
