import { describe, expect, it } from 'vitest';
import {
  bancoPlataforma,
  condicionCierrePlataforma,
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
      separacionFunciones: true,
      extra: 'se ignora',
    });
    expect(empresa).toEqual({
      id: ID,
      razonSocial: 'Ferretería Aurora S.A. de C.V.',
      rfc: 'FAU210215QK4',
      separacionFunciones: true,
    });
  });

  it('una empresa sin `separacionFunciones` falla en voz alta', () => {
    expect(
      empresaCreadaPlataforma.safeParse({
        id: ID,
        razonSocial: 'X',
        rfc: 'FAU210215QK4',
      }).success,
    ).toBe(false);
  });

  it('una respuesta sin RFC falla en voz alta', () => {
    expect(
      empresaCreadaPlataforma.safeParse({ id: ID, razonSocial: 'X' }).success,
    ).toBe(false);
  });

  it('la lista reutiliza la forma de la empresa creada', () => {
    const fila = {
      id: ID,
      razonSocial: 'Aurora',
      rfc: 'FAU210215QK4',
      separacionFunciones: false,
    };
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

describe('contrato de la condición de cierre automático (9.5)', () => {
  const criterio = (pide: number, hoy: number) => ({
    pide,
    hoy,
    falta: hoy >= pide ? 0 : pide - hoy,
    cumple: hoy >= pide,
  });
  const CONDICION = {
    cumple: false,
    criterios: {
      propuestas: criterio(1000, 350),
      empresas: criterio(3, 3),
      meses: criterio(3, 2),
    },
    tasa: {
      registradas: { casos: 283, desacuerdos: 14, tasa: '0.0495' },
      muestra: { casos: 40, desacuerdos: 1, tasa: '0.0250' },
      usada: 'registradas',
      tasaUsada: '0.0495',
      exceso: '0.0445',
      maxima: '0.0050',
      cumple: false,
    },
  };

  it('acepta la respuesta con las tasas como texto', () => {
    expect(condicionCierrePlataforma.parse(CONDICION)).toEqual(CONDICION);
  });

  it('acepta la respuesta sin datos: tasas, usada y exceso nulos', () => {
    const vacia = {
      ...CONDICION,
      tasa: {
        ...CONDICION.tasa,
        registradas: { casos: 0, desacuerdos: 0, tasa: null },
        muestra: { casos: 0, desacuerdos: 0, tasa: null },
        usada: null,
        tasaUsada: null,
        exceso: null,
      },
    };
    expect(condicionCierrePlataforma.parse(vacia)).toEqual(vacia);
  });

  it('una tasa que llega como número no vale: viaja como texto', () => {
    const mala = {
      ...CONDICION,
      tasa: { ...CONDICION.tasa, exceso: 0.0445 },
    };
    expect(condicionCierrePlataforma.safeParse(mala).success).toBe(false);
  });

  it('sin un criterio falla en voz alta: el frontend no lo inventa', () => {
    const criterios = {
      propuestas: CONDICION.criterios.propuestas,
      empresas: CONDICION.criterios.empresas,
    };
    expect(
      condicionCierrePlataforma.safeParse({ ...CONDICION, criterios }).success,
    ).toBe(false);
  });

  it('conteos negativos o con decimales no valen', () => {
    const mala = {
      ...CONDICION,
      criterios: {
        ...CONDICION.criterios,
        propuestas: { ...criterio(1000, 350), hoy: -1 },
      },
    };
    expect(condicionCierrePlataforma.safeParse(mala).success).toBe(false);
  });

  it('«usada» solo puede ser registradas, muestra o nulo', () => {
    const mala = { ...CONDICION, tasa: { ...CONDICION.tasa, usada: 'otra' } };
    expect(condicionCierrePlataforma.safeParse(mala).success).toBe(false);
  });
});
