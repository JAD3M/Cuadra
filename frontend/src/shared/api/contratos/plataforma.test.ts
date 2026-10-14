import { describe, expect, it } from 'vitest';
import {
  empresaCreadaPlataforma,
  listaEmpresasPlataforma,
  solicitudCrearEmpresa,
} from './plataforma';

const ID = '00000000-0000-4000-8000-000000000001';

describe('contrato de empresas de plataforma', () => {
  it('la empresa creada trae id, razón social y RFC; ignora claves de más', () => {
    const empresa = empresaCreadaPlataforma.parse({
      id: ID,
      razonSocial: 'Ferretería Aurora S.A. de C.V.',
      rfc: 'FAU210215QK4',
      extra: 'se ignora',
    });
    expect(empresa).toEqual({
      id: ID,
      razonSocial: 'Ferretería Aurora S.A. de C.V.',
      rfc: 'FAU210215QK4',
    });
  });

  it('una respuesta sin RFC falla en voz alta', () => {
    expect(
      empresaCreadaPlataforma.safeParse({ id: ID, razonSocial: 'X' }).success,
    ).toBe(false);
  });

  it('la lista reutiliza la forma de la empresa creada', () => {
    const fila = { id: ID, razonSocial: 'Aurora', rfc: 'FAU210215QK4' };
    expect(listaEmpresasPlataforma.parse([fila])).toEqual([fila]);
  });

  it('la solicitud lleva razonSocial y rfc', () => {
    expect(
      solicitudCrearEmpresa.parse({
        razonSocial: 'Aurora',
        rfc: 'FAU210215QK4',
      }),
    ).toEqual({ razonSocial: 'Aurora', rfc: 'FAU210215QK4' });
    expect(
      solicitudCrearEmpresa.safeParse({ razonSocial: 'Aurora' }).success,
    ).toBe(false);
  });
});
