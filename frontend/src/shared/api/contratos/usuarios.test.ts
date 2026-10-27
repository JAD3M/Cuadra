import { describe, expect, it } from 'vitest';
import { ROLES } from '@/shared/dominio';
import {
  solicitudCambiarRoles,
  usuarioRoles,
  invitacionCancelada,
  invitacionReenviada,
  invitacionUsuarioEnviada,
  solicitudInvitarUsuario,
  usuarioListado,
  usuariosListado,
} from './usuarios';

describe('contrato de invitar usuarios (2.3)', () => {
  it('la solicitud manda `email` y uno o más roles', () => {
    expect(
      solicitudInvitarUsuario.parse({
        email: 'marta@ferreteria.mx',
        roles: ['contador', 'revisor'],
      }),
    ).toEqual({ email: 'marta@ferreteria.mx', roles: ['contador', 'revisor'] });
  });

  it('acepta cada rol del espejo', () => {
    for (const rol of ROLES) {
      expect(
        solicitudInvitarUsuario.safeParse({ email: 'a@b.mx', roles: [rol] })
          .success,
      ).toBe(true);
    }
  });

  it('rechaza una lista de roles vacía', () => {
    expect(
      solicitudInvitarUsuario.safeParse({ email: 'a@b.mx', roles: [] }).success,
    ).toBe(false);
  });

  it('rechaza un rol desconocido', () => {
    expect(
      solicitudInvitarUsuario.safeParse({
        email: 'a@b.mx',
        roles: ['contador', 'superusuario'],
      }).success,
    ).toBe(false);
  });

  it('rechaza un correo vacío o sin roles', () => {
    expect(
      solicitudInvitarUsuario.safeParse({ email: '', roles: ['auditor'] })
        .success,
    ).toBe(false);
    expect(solicitudInvitarUsuario.safeParse({ email: 'a@b.mx' }).success).toBe(
      false,
    );
  });

  it('la respuesta trae `email` y `roles` y ignora claves extra', () => {
    expect(
      invitacionUsuarioEnviada.parse({
        email: 'a@b.mx',
        roles: ['admin'],
        x: 1,
      }),
    ).toEqual({ email: 'a@b.mx', roles: ['admin'] });
  });

  it('una respuesta sin roles o con un rol desconocido falla', () => {
    expect(
      invitacionUsuarioEnviada.safeParse({ email: 'a@b.mx' }).success,
    ).toBe(false);
    expect(
      invitacionUsuarioEnviada.safeParse({ email: 'a@b.mx', roles: ['otro'] })
        .success,
    ).toBe(false);
  });
});

describe('contrato de reenviar y cancelar (2.4)', () => {
  it('reenviar responde `email` y `roles`; cancelar solo `email`', () => {
    expect(
      invitacionReenviada.parse({ email: 'a@b.mx', roles: ['auditor'] }),
    ).toEqual({ email: 'a@b.mx', roles: ['auditor'] });
    expect(invitacionReenviada.safeParse({ email: 'a@b.mx' }).success).toBe(
      false,
    );
    expect(invitacionCancelada.parse({ email: 'a@b.mx', x: 1 })).toEqual({
      email: 'a@b.mx',
    });
    expect(invitacionCancelada.safeParse({}).success).toBe(false);
  });
});

describe('contrato de la lista de usuarios (2.5)', () => {
  const activa = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ana@ferreteria.mx',
    nombre: 'Ana Mendoza',
    roles: ['admin'],
    estado: 'activo',
    invitacionId: null,
    vencida: false,
    venceEn: null,
    creadaEn: null,
    invitadaPor: null,
  };
  const pendiente = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'marta@ferreteria.mx',
    nombre: null,
    roles: ['contador', 'revisor'],
    estado: 'pendiente',
    invitacionId: '22222222-2222-4222-8222-222222222222',
    vencida: true,
    venceEn: '2026-10-10T15:00:00.000Z',
    creadaEn: '2026-10-03T15:00:00.000Z',
    invitadaPor: 'Ana Mendoza',
  };

  it('acepta una fila activa y una pendiente', () => {
    expect(usuarioListado.parse(activa)).toEqual(activa);
    expect(usuarioListado.parse(pendiente)).toEqual(pendiente);
    expect(usuariosListado.parse([activa, pendiente])).toHaveLength(2);
  });

  it('rechaza una pendiente sin `invitacionId`, `venceEn` o `creadaEn`', () => {
    for (const campo of ['invitacionId', 'venceEn', 'creadaEn']) {
      expect(
        usuarioListado.safeParse({ ...pendiente, [campo]: null }).success,
      ).toBe(false);
    }
  });

  it.each(['venceEn', 'creadaEn', 'invitadaPor'])(
    'rechaza una activa con `%s` (solo las pendientes lo traen)',
    (campo) => {
      const valor =
        campo === 'invitadaPor' ? 'Ana Mendoza' : '2026-10-10T15:00:00.000Z';
      expect(
        usuarioListado.safeParse({ ...activa, [campo]: valor }).success,
      ).toBe(false);
    },
  );

  it('rechaza una activa con `invitacionId`', () => {
    expect(
      usuarioListado.safeParse({
        ...activa,
        invitacionId: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(false);
  });

  it('rechaza un estado o un rol desconocido', () => {
    expect(
      usuarioListado.safeParse({ ...activa, estado: 'baja' }).success,
    ).toBe(false);
    expect(
      usuarioListado.safeParse({ ...activa, roles: ['dueno'] }).success,
    ).toBe(false);
  });

  it('rechaza una fila sin `invitacionId` o con `vencida` no booleana', () => {
    const sin: Record<string, unknown> = { ...activa };
    delete sin['invitacionId'];
    expect(usuarioListado.safeParse(sin).success).toBe(false);
    expect(usuarioListado.safeParse({ ...activa, vencida: 'no' }).success).toBe(
      false,
    );
  });
});

describe('contrato de cambiar y quitar roles (2.6)', () => {
  const ID = '55555555-5555-4555-8555-555555555551';

  it('la solicitud manda de 1 a 4 roles del espejo', () => {
    expect(
      solicitudCambiarRoles.parse({ roles: ['contador', 'revisor'] }),
    ).toEqual({ roles: ['contador', 'revisor'] });
    expect(solicitudCambiarRoles.safeParse({ roles: [...ROLES] }).success).toBe(
      true,
    );
  });

  it('rechaza roles vacíos, desconocidos o ausentes', () => {
    expect(solicitudCambiarRoles.safeParse({ roles: [] }).success).toBe(false);
    expect(solicitudCambiarRoles.safeParse({ roles: ['dueno'] }).success).toBe(
      false,
    );
    expect(solicitudCambiarRoles.safeParse({}).success).toBe(false);
  });

  it('rechaza más roles que el espejo', () => {
    expect(
      solicitudCambiarRoles.safeParse({ roles: [...ROLES, 'admin'] }).success,
    ).toBe(false);
  });

  it('la respuesta trae id, correo y roles (vacíos si se quitó el acceso)', () => {
    expect(
      usuarioRoles.parse({ id: ID, email: 'a@b.mx', roles: ['auditor'] }),
    ).toEqual({ id: ID, email: 'a@b.mx', roles: ['auditor'] });
    expect(
      usuarioRoles.parse({ id: ID, email: 'a@b.mx', roles: [] }).roles,
    ).toEqual([]);
  });

  it('la respuesta rechaza un id que no es uuid o un rol desconocido', () => {
    expect(
      usuarioRoles.safeParse({ id: 'x', email: 'a@b.mx', roles: [] }).success,
    ).toBe(false);
    expect(
      usuarioRoles.safeParse({ id: ID, email: 'a@b.mx', roles: ['dueno'] })
        .success,
    ).toBe(false);
  });
});
