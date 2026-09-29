import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../common/entities/tipos';
import type { AccesosDenegados } from '../../bitacora/accesos-denegados';
import type { AuthService } from '../auth.service';
import { LLAVE_ROLES } from '../../common/decorators/decoradores';
import { RolesGuard } from './roles.guard';
import type { UsuarioAutenticado } from '../tipos';

const SESION: UsuarioAutenticado = {
  userId: 'usuario-1',
  scope: 'sesion',
  companyId: 'empresa-a',
};

function contexto(user: UsuarioAutenticado): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        method: 'GET',
        path: '/prueba/admin',
        ip: '203.0.113.7',
        headers: { 'user-agent': 'jest' },
      }),
    }),
  } as unknown as ExecutionContext;
}

function guard(rolesDelUsuario: Rol[], requeridos?: Rol[]) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((llave) =>
      llave === LLAVE_ROLES ? requeridos : undefined,
    );
  const rolesEnEmpresa = jest.fn().mockResolvedValue(rolesDelUsuario);
  const authService = { rolesEnEmpresa } as unknown as AuthService;
  const registrar = jest.fn().mockResolvedValue(undefined);
  const accesos = { registrar } as unknown as AccesosDenegados;
  return {
    guard: new RolesGuard(authService, reflector, accesos),
    rolesEnEmpresa,
    registrar,
  };
}

describe('RolesGuard', () => {
  it('autoriza cuando uno de sus dos roles alcanza (D-08)', async () => {
    const { guard: g } = guard(['contador', 'revisor'], ['revisor']);
    await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
  });

  it('rechaza con 403 cuando ninguno de sus roles alcanza', async () => {
    const { guard: g } = guard(['contador', 'revisor'], ['admin']);
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('sin @Roles exige igual membresía vigente en la empresa', async () => {
    const { guard: g } = guard([]);
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lee los roles de la base con el usuario y la empresa del token', async () => {
    const { guard: g, rolesEnEmpresa } = guard(['admin'], ['admin']);
    await g.canActivate(contexto(SESION));
    expect(rolesEnEmpresa).toHaveBeenCalledWith('usuario-1', 'empresa-a');
  });

  it('no consulta roles con un token de selección', async () => {
    const { guard: g, rolesEnEmpresa } = guard([], ['admin']);
    await expect(
      g.canActivate(contexto({ userId: 'usuario-1', scope: 'seleccion' })),
    ).resolves.toBe(true);
    expect(rolesEnEmpresa).not.toHaveBeenCalled();
  });

  it('rol insuficiente: registra el acceso denegado y luego da 403', async () => {
    const { guard: g, registrar } = guard(['contador'], ['admin']);
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith({
      companyId: 'empresa-a',
      userId: 'usuario-1',
      metodo: 'GET',
      ruta: '/prueba/admin',
      rolesRequeridos: ['admin'],
      rolesDelUsuario: ['contador'],
      ip: '203.0.113.7',
      userAgent: 'jest',
    });
  });

  it('sin membresía también se registra, con roles vacíos', async () => {
    const { guard: g, registrar } = guard([]);
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ rolesRequeridos: [], rolesDelUsuario: [] }),
    );
  });

  it('un acceso autorizado no escribe en la bitácora', async () => {
    const { guard: g, registrar } = guard(['admin'], ['admin']);
    await g.canActivate(contexto(SESION));
    expect(registrar).not.toHaveBeenCalled();
  });
});
