import { describe, expect, it } from 'vitest';
import { ROLES } from '@/shared/dominio';
import { invitacionUsuarioEnviada, solicitudInvitarUsuario } from './usuarios';

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
