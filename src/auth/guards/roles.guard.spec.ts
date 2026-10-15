import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../common/entities/tipos';
import type { AccesosDenegados } from '../../bitacora/accesos-denegados';
import type { AuthService } from '../auth.service';
import {
  LLAVE_PERMISO,
  LLAVE_SCOPE,
} from '../../common/decorators/decoradores';
import type { PermisoEmpresa } from '../permisos/matriz';
import { RolesGuard } from './roles.guard';
import type { Scope, UsuarioAutenticado } from '../tipos';

const SESION: UsuarioAutenticado = {
  userId: 'usuario-1',
  scope: 'sesion',
  companyId: 'empresa-a',
  sesionId: 'sesion-1',
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

function guard(
  rolesDelUsuario: Rol[],
  permiso?: PermisoEmpresa,
  scopes?: Scope[],
) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((llave) => {
    if (llave === LLAVE_PERMISO) return permiso;
    if (llave === LLAVE_SCOPE) return scopes;
    return undefined;
  });
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
  it('autoriza cuando uno de sus dos roles tiene el permiso (D-08)', async () => {
    const { guard: g } = guard(
      ['auditor', 'revisor'],
      'conciliaciones.resolver',
    );
    await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
  });

  it('rechaza con 403 cuando ninguno de sus roles tiene el permiso', async () => {
    const { guard: g } = guard(['contador', 'revisor'], 'tolerancia.editar');
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('sin @Permiso exige igual membresía vigente en la empresa', async () => {
    const { guard: g } = guard([]);
    await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lee los roles de la base con el usuario y la empresa de la sesión', async () => {
    const { guard: g, rolesEnEmpresa } = guard(['admin'], 'tolerancia.editar');
    await g.canActivate(contexto(SESION));
    expect(rolesEnEmpresa).toHaveBeenCalledWith('usuario-1', 'empresa-a');
  });

  it('no consulta roles con una sesión sin empresa', async () => {
    const { guard: g, rolesEnEmpresa } = guard([], 'tolerancia.editar');
    await expect(
      g.canActivate(
        contexto({
          userId: 'usuario-1',
          scope: 'seleccion',
          sesionId: 'sesion-1',
        }),
      ),
    ).resolves.toBe(true);
    expect(rolesEnEmpresa).not.toHaveBeenCalled();
  });

  it('rol insuficiente: registra el acceso denegado y luego da 403', async () => {
    const { guard: g, registrar } = guard(['contador'], 'tolerancia.editar');
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
      permiso: 'tolerancia.editar',
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
      expect.objectContaining({
        rolesRequeridos: [],
        rolesDelUsuario: [],
        permiso: undefined,
      }),
    );
  });

  it('un acceso autorizado no escribe en la bitácora', async () => {
    const { guard: g, registrar } = guard(['admin'], 'tolerancia.editar');
    await g.canActivate(contexto(SESION));
    expect(registrar).not.toHaveBeenCalled();
  });

  describe('auditor y permiso faltante', () => {
    it.each([
      'conciliaciones.resolver',
      'cargas.cargar',
      'movimientos.descartar',
      'conciliaciones.reabrir',
    ] as const)('el auditor recibe 403 en %s y queda el permiso', async (p) => {
      const { guard: g, registrar } = guard(['auditor'], p);
      await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
        'Rol insuficiente',
      );
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          permiso: p,
          rolesDelUsuario: ['auditor'],
        }),
      );
    });

    it('el auditor sí consulta la bandeja y la bitácora', async () => {
      for (const p of ['bandeja.ver', 'bitacora.ver'] as const) {
        const { guard: g } = guard(['auditor'], p);
        await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
      }
    });

    it('un rol con el permiso pasa aunque otro no lo tenga', async () => {
      const { guard: g } = guard(['auditor', 'contador'], 'cargas.cargar');
      await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
    });
  });

  describe('endpoint que acepta seleccion y sesion', () => {
    const AMBOS: Scope[] = ['seleccion', 'sesion'];

    it('sin @Permiso deja pasar a quien perdió su rol en la empresa actual', async () => {
      const {
        guard: g,
        rolesEnEmpresa,
        registrar,
      } = guard([], undefined, AMBOS);
      await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
      expect(rolesEnEmpresa).not.toHaveBeenCalled();
      expect(registrar).not.toHaveBeenCalled();
    });

    it('con @Permiso exige membresía: sin roles da 403 y lo registra', async () => {
      const { guard: g, registrar } = guard([], 'tolerancia.editar', AMBOS);
      await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
        'Sin acceso a esta empresa',
      );
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          rolesRequeridos: ['admin'],
          rolesDelUsuario: [],
          permiso: 'tolerancia.editar',
        }),
      );
    });

    it('con @Permiso y un rol que no alcanza da 403 Rol insuficiente', async () => {
      const { guard: g, registrar } = guard(
        ['contador'],
        'tolerancia.editar',
        AMBOS,
      );
      await expect(g.canActivate(contexto(SESION))).rejects.toThrow(
        'Rol insuficiente',
      );
      expect(registrar).toHaveBeenCalledTimes(1);
    });

    it('con @Permiso y un rol que alcanza autoriza', async () => {
      const { guard: g } = guard(['admin'], 'tolerancia.editar', AMBOS);
      await expect(g.canActivate(contexto(SESION))).resolves.toBe(true);
    });

    it('con sesión sin empresa autoriza aunque declare @Permiso', async () => {
      const { guard: g, rolesEnEmpresa } = guard(
        [],
        'tolerancia.editar',
        AMBOS,
      );
      await expect(
        g.canActivate(
          contexto({
            userId: 'usuario-1',
            scope: 'seleccion',
            sesionId: 'sesion-1',
          }),
        ),
      ).resolves.toBe(true);
      expect(rolesEnEmpresa).not.toHaveBeenCalled();
    });
  });
});
