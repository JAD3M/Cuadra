import { describe, expect, it } from 'vitest';
import { vistaMedicionPlataforma } from './vistaMedicionPlataforma';

const FILA = {
  companyId: '00000000-0000-4000-8000-000000000001',
  razonSocial: 'Ferretería del Bajío',
  banco: 'bbva' as string | null,
  propuestas: 240,
  tratadas: 200,
  desacuerdos: 8,
  tasa: '0.0400' as string | null,
};

const FRACCION = {
  companyId: '00000000-0000-4000-8000-000000000001',
  razonSocial: 'Ferretería del Bajío',
  facturas: { total: 40, ppd: 10 },
  movimientos: { total: 240, parcialidades: 3, comisiones: 12 },
  fraccionPpd: '0.2500' as string | null,
  fraccionParcialidades: '0.0125' as string | null,
  fraccionComisiones: '0.0500' as string | null,
};

const LISTO = { cargando: false, error: false };

describe('vistaMedicionPlataforma (historia 9.2)', () => {
  it('cargando mientras falta alguna de las dos lecturas', () => {
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { cargando: true, error: false, datos: undefined },
        fracciones: { ...LISTO, datos: [FRACCION] },
      }),
    ).toEqual({ tipo: 'cargando' });
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { ...LISTO, datos: [FILA] },
        fracciones: { cargando: true, error: false, datos: undefined },
      }),
    ).toEqual({ tipo: 'cargando' });
  });

  it('error si falla cualquiera de las dos, aunque la otra siga cargando', () => {
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { cargando: false, error: true, datos: undefined },
        fracciones: { cargando: true, error: false, datos: undefined },
      }),
    ).toEqual({ tipo: 'error' });
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { ...LISTO, datos: [FILA] },
        fracciones: { cargando: false, error: true, datos: undefined },
      }),
    ).toEqual({ tipo: 'error' });
  });

  it('formatea la tasa sin flotante y deja la muestra como conteos', () => {
    const vista = vistaMedicionPlataforma({
      desacuerdo: {
        ...LISTO,
        datos: [
          FILA,
          { ...FILA, banco: 'banorte', tasa: '0.1000' },
          { ...FILA, banco: null, tratadas: 0, desacuerdos: 0, tasa: null },
        ],
      },
      fracciones: { ...LISTO, datos: [] },
    });
    if (vista.tipo !== 'listo') throw new Error('se esperaba listo');
    expect(vista.desacuerdo.map((f) => f.tasa)).toEqual([
      '4.00 %',
      '10.00 %',
      null,
    ]);
    expect(vista.desacuerdo[0]).toMatchObject({
      razonSocial: 'Ferretería del Bajío',
      banco: 'bbva',
      propuestas: 240,
      tratadas: 200,
      desacuerdos: 8,
    });
    expect(vista.desacuerdo[2]?.banco).toBeNull();
  });

  it('sin filas de desacuerdo: lista vacía y las fracciones siguen', () => {
    const vista = vistaMedicionPlataforma({
      desacuerdo: { ...LISTO, datos: [] },
      fracciones: { ...LISTO, datos: [FRACCION] },
    });
    if (vista.tipo !== 'listo') throw new Error('se esperaba listo');
    expect(vista.desacuerdo).toEqual([]);
    expect(vista.fracciones).toHaveLength(1);
  });

  it('cada fracción lleva su porcentaje y su conteo «N de M»', () => {
    const vista = vistaMedicionPlataforma({
      desacuerdo: { ...LISTO, datos: [] },
      fracciones: {
        ...LISTO,
        datos: [
          FRACCION,
          {
            ...FRACCION,
            razonSocial: 'Distribuidora Aurora',
            facturas: { total: 0, ppd: 0 },
            movimientos: { total: 0, parcialidades: 0, comisiones: 0 },
            fraccionPpd: null,
            fraccionParcialidades: null,
            fraccionComisiones: null,
          },
        ],
      },
    });
    if (vista.tipo !== 'listo') throw new Error('se esperaba listo');
    expect(vista.fracciones[0]).toMatchObject({
      ppd: { porcentaje: '25.00 %', n: 10, de: 40 },
      parcialidades: { porcentaje: '1.25 %', n: 3, de: 240 },
      comisiones: { porcentaje: '5.00 %', n: 12, de: 240 },
    });
    expect(vista.fracciones[1]).toMatchObject({
      ppd: { porcentaje: null, n: 0, de: 0 },
      parcialidades: { porcentaje: null },
      comisiones: { porcentaje: null },
    });
  });

  it('una fracción que no es una tasa válida se muestra como ausente, nunca inventada', () => {
    const vista = vistaMedicionPlataforma({
      desacuerdo: { ...LISTO, datos: [{ ...FILA, tasa: 'abc' }] },
      fracciones: { ...LISTO, datos: [{ ...FRACCION, fraccionPpd: '2.5' }] },
    });
    if (vista.tipo !== 'listo') throw new Error('se esperaba listo');
    expect(vista.desacuerdo[0]?.tasa).toBeNull();
    expect(vista.fracciones[0]?.ppd.porcentaje).toBeNull();
  });
});
