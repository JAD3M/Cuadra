import { describe, expect, it } from 'vitest';
import { ROLES } from '@/shared/dominio';
import {
  invitacionCancelada,
  invitacionPendiente,
  invitacionReenviada,
  invitacionUsuarioEnviada,
  invitacionesPendientes,
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

const PENDIENTE = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'marta.nunez@ferreteria.mx',
  roles: ['contador', 'revisor'],
  creadaEn: '2026-10-14T15:00:00.000Z',
  venceEn: '2026-10-21T15:00:00.000Z',
  vencida: false,
  invitadaPor: 'Ana Mendoza',
};

describe('contrato de invitaciones pendientes (2.4)', () => {
  it('acepta una pendiente y ignora claves extra', () => {
    expect(invitacionPendiente.parse({ ...PENDIENTE, x: 1 })).toEqual(
      PENDIENTE,
    );
  });

  it('`invitadaPor` puede ser nulo (la creó la plataforma)', () => {
    expect(
      invitacionPendiente.parse({ ...PENDIENTE, invitadaPor: null })
        .invitadaPor,
    ).toBeNull();
  });

  it('la lista acepta cero o más filas', () => {
    expect(invitacionesPendientes.parse([])).toEqual([]);
    expect(invitacionesPendientes.parse([PENDIENTE])).toHaveLength(1);
  });

  it.each([
    ['sin id', { id: undefined }],
    ['id que no es uuid', { id: 'abc' }],
    ['correo vacío', { email: '' }],
    ['sin roles', { roles: [] }],
    ['rol desconocido', { roles: ['superusuario'] }],
    ['fecha de envío ilegible', { creadaEn: 'ayer' }],
    ['sin vencimiento', { venceEn: undefined }],
    ['vencida que no es booleano', { vencida: 'no' }],
    ['sin vencida', { vencida: undefined }],
    ['invitadaPor ausente', { invitadaPor: undefined }],
  ])('rechaza una pendiente mal formada: %s', (_caso, cambio) => {
    expect(
      invitacionPendiente.safeParse({ ...PENDIENTE, ...cambio }).success,
    ).toBe(false);
  });

  it('una lista con una fila mal formada falla completa', () => {
    expect(
      invitacionesPendientes.safeParse([PENDIENTE, { ...PENDIENTE, id: 1 }])
        .success,
    ).toBe(false);
  });

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
