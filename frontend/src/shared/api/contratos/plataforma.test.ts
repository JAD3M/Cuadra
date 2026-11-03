import { describe, expect, it } from 'vitest';
import {
  bancoPlataforma,
  listaBancosPlataforma,
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

describe('contrato de bancos de plataforma', () => {
  const BANCO = {
    banco: 'bbva',
    aceptadas: 5,
    minimoAceptadas: 5,
    levantada: false,
    levantadaEn: null,
  };

  it('el banco trae el mínimo que fija el servidor; ignora claves de más', () => {
    expect(bancoPlataforma.parse({ ...BANCO, extra: 1 })).toEqual(BANCO);
  });

  it('un banco levantado trae su instante ISO', () => {
    const levantado = {
      ...BANCO,
      levantada: true,
      levantadaEn: '2026-11-03T18:30:00.000Z',
    };
    expect(listaBancosPlataforma.parse([levantado])).toEqual([levantado]);
  });

  it('sin el mínimo falla en voz alta: el frontend no lo inventa', () => {
    const sinMinimo: Record<string, unknown> = { ...BANCO };
    delete sinMinimo['minimoAceptadas'];
    expect(bancoPlataforma.safeParse(sinMinimo).success).toBe(false);
  });

  it('cargas aceptadas negativas o con decimales no valen', () => {
    expect(bancoPlataforma.safeParse({ ...BANCO, aceptadas: -1 }).success).toBe(
      false,
    );
    expect(
      bancoPlataforma.safeParse({ ...BANCO, aceptadas: 1.5 }).success,
    ).toBe(false);
  });
});
