import { describe, expect, it } from 'vitest';
import {
  estadoInvitacion,
  invitacionAceptada,
  invitacionEnviada,
  solicitudAceptarInvitacion,
  solicitudInvitarAdmin,
} from './invitaciones';

const ID = '00000000-0000-4000-8000-000000000001';

describe('contrato de invitaciones', () => {
  it('invitar manda solo `email` y la respuesta trae `email`', () => {
    expect(solicitudInvitarAdmin.parse({ email: 'a@b.mx' })).toEqual({
      email: 'a@b.mx',
    });
    expect(invitacionEnviada.parse({ email: 'a@b.mx', x: 1 })).toEqual({
      email: 'a@b.mx',
    });
    expect(invitacionEnviada.safeParse({}).success).toBe(false);
  });

  it('un enlace vigente trae empresa y si hay que elegir contraseña', () => {
    const estado = estadoInvitacion.parse({
      estado: 'vigente',
      motivo: null,
      empresa: 'Ferretería Aurora',
      requierePassword: true,
    });
    expect(estado).toEqual({
      estado: 'vigente',
      motivo: null,
      empresa: 'Ferretería Aurora',
      requierePassword: true,
    });
  });

  it.each(['usada', 'caducada', 'reemplazada', 'desconocida'])(
    'un enlace inválido por %s no trae datos',
    (motivo) => {
      const estado = estadoInvitacion.parse({
        estado: 'invalida',
        motivo,
        empresa: null,
        requierePassword: null,
      });
      expect(estado.estado).toBe('invalida');
    },
  );

  it('un motivo desconocido o un estado vigente sin empresa falla', () => {
    expect(
      estadoInvitacion.safeParse({
        estado: 'invalida',
        motivo: 'otro',
        empresa: null,
        requierePassword: null,
      }).success,
    ).toBe(false);
    expect(
      estadoInvitacion.safeParse({
        estado: 'vigente',
        motivo: null,
        empresa: null,
        requierePassword: false,
      }).success,
    ).toBe(false);
  });

  it('aceptar manda `nombre` y `password` opcionales; la respuesta trae la empresa', () => {
    expect(solicitudAceptarInvitacion.parse({})).toEqual({});
    expect(
      invitacionAceptada.parse({
        companyId: ID,
        razonSocial: 'Aurora',
        cuentaNueva: false,
      }),
    ).toEqual({ companyId: ID, razonSocial: 'Aurora', cuentaNueva: false });
  });
});
