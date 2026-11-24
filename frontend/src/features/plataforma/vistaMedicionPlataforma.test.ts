import { describe, expect, it } from 'vitest';
import type { CondicionCierrePlataforma } from '@/shared/api/contratos/plataforma';
import {
  vistaMedicionPlataforma as vistaDeTres,
  type EntradaVistaPlataforma,
} from './vistaMedicionPlataforma';

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

const criterio = (pide: number, hoy: number) => ({
  pide,
  hoy,
  falta: hoy >= pide ? 0 : pide - hoy,
  cumple: hoy >= pide,
});

/** Lo que el mockup 20 enseña como «todavía no se cumple». */
const NO_CUMPLE: CondicionCierrePlataforma = {
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

/** Lo que el mockup 20 enseña como «se cumple». */
const CUMPLE: CondicionCierrePlataforma = {
  cumple: true,
  criterios: {
    propuestas: criterio(1000, 1240),
    empresas: criterio(3, 4),
    meses: criterio(3, 4),
  },
  tasa: {
    registradas: { casos: 940, desacuerdos: 3, tasa: '0.0032' },
    muestra: { casos: 250, desacuerdos: 1, tasa: '0.0040' },
    usada: 'muestra',
    tasaUsada: '0.0040',
    exceso: '0.0000',
    maxima: '0.0050',
    cumple: true,
  },
};

/** Lo que el mockup 20 enseña como «sin datos». */
const SIN_DATOS: CondicionCierrePlataforma = {
  cumple: false,
  criterios: {
    propuestas: criterio(1000, 0),
    empresas: criterio(3, 0),
    meses: criterio(3, 0),
  },
  tasa: {
    registradas: { casos: 0, desacuerdos: 0, tasa: null },
    muestra: { casos: 0, desacuerdos: 0, tasa: null },
    usada: null,
    tasaUsada: null,
    exceso: null,
    maxima: '0.0050',
    cumple: false,
  },
};

/** Las dos lecturas de la 9.2 más la condición (por omisión, lista). */
function vistaMedicionPlataforma(
  e: Omit<EntradaVistaPlataforma, 'condicion'> &
    Partial<Pick<EntradaVistaPlataforma, 'condicion'>>,
) {
  return vistaDeTres({
    condicion: { ...LISTO, datos: NO_CUMPLE },
    ...e,
  });
}

function condicionDe(datos: CondicionCierrePlataforma) {
  const vista = vistaMedicionPlataforma({
    desacuerdo: { ...LISTO, datos: [] },
    fracciones: { ...LISTO, datos: [] },
    condicion: { ...LISTO, datos },
  });
  if (vista.tipo !== 'listo') throw new Error('se esperaba listo');
  return vista.condicion;
}

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

describe('vistaMedicionPlataforma: condición de cierre (historia 9.5)', () => {
  it('cargando mientras falta la condición, aunque las otras dos estén', () => {
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { ...LISTO, datos: [FILA] },
        fracciones: { ...LISTO, datos: [FRACCION] },
        condicion: { cargando: true, error: false, datos: undefined },
      }),
    ).toEqual({ tipo: 'cargando' });
  });

  it('error si falla la condición, aunque otra siga cargando', () => {
    expect(
      vistaMedicionPlataforma({
        desacuerdo: { cargando: true, error: false, datos: undefined },
        fracciones: { ...LISTO, datos: [FRACCION] },
        condicion: { cargando: false, error: true, datos: undefined },
      }),
    ).toEqual({ tipo: 'error' });
  });

  it('no cumple: cada umbral con su «se pide», «hoy», «falta» y estado del servidor', () => {
    const c = condicionDe(NO_CUMPLE);
    expect(c.cumple).toBe(false);
    expect(
      c.criterios.map((k) => [k.nombre, k.pide, k.hoy, k.falta, k.cumple]),
    ).toEqual([
      ['Propuestas de la regla 1', '≥ 1,000', '350', '650', false],
      ['Empresas distintas', '≥ 3', '3', '0', true],
      ['Meses con propuestas', '≥ 3', '2', '1', false],
      ['Tasa de desacuerdo', '≤ 0.50 %', '4.95 %', '4.45 puntos de más', false],
    ]);
    expect(c.criterios.map((k) => k.nota)).toEqual([
      'En todas las empresas',
      'Con al menos una propuesta',
      'Meses distintos con datos',
      'La más alta de las dos medidas',
    ]);
  });

  it('no cumple: el resumen dice qué falta y que la tasa supera el límite', () => {
    expect(condicionDe(NO_CUMPLE).resumen).toBe(
      'Faltan 650 propuestas y 1 mes de datos, y la tasa de desacuerdo supera el límite de 0.50 %.',
    );
  });

  it('las dos tasas por separado, con su conteo y cuál se usa', () => {
    const c = condicionDe(NO_CUMPLE);
    expect(c.registradas).toEqual({
      tasa: '4.95 %',
      detalle: '14 desacuerdos en 283 propuestas tratadas',
      usada: true,
    });
    expect(c.muestra).toEqual({
      tasa: '2.50 %',
      detalle: '1 desacuerdo en 40 casos verificados',
      usada: false,
    });
  });

  it('cumple: «Dentro del límite» y la muestra es la que se usa', () => {
    const c = condicionDe(CUMPLE);
    expect(c.cumple).toBe(true);
    expect(c.criterios.map((k) => [k.hoy, k.falta, k.cumple])).toEqual([
      ['1,240', '0', true],
      ['4', '0', true],
      ['4', '0', true],
      ['0.40 %', 'Dentro del límite', true],
    ]);
    expect(c.registradas).toMatchObject({ tasa: '0.32 %', usada: false });
    expect(c.muestra).toMatchObject({
      tasa: '0.40 %',
      detalle: '1 desacuerdo en 250 casos verificados',
      usada: true,
    });
  });

  it('sin datos: ceros, tasas «—», «Sin casos todavía» y ninguna tasa usada', () => {
    const c = condicionDe(SIN_DATOS);
    expect(c.cumple).toBe(false);
    expect(c.resumen).toBe(
      'Aún no hay propuestas de la regla 1 ni casos verificados.',
    );
    expect(c.criterios.map((k) => [k.hoy, k.falta, k.cumple])).toEqual([
      ['0', '1,000', false],
      ['0', '3', false],
      ['0', '3', false],
      ['—', 'Sin casos todavía', false],
    ]);
    expect(c.registradas).toEqual({
      tasa: '—',
      detalle: 'Sin propuestas tratadas',
      usada: false,
    });
    expect(c.muestra).toEqual({
      tasa: '—',
      detalle: 'Sin casos verificados',
      usada: false,
    });
  });

  it('una tasa que no es texto decimal válido se muestra «—», nunca inventada', () => {
    const c = condicionDe({
      ...NO_CUMPLE,
      tasa: {
        ...NO_CUMPLE.tasa,
        registradas: { casos: 283, desacuerdos: 14, tasa: 'abc' },
      },
    });
    expect(c.registradas.tasa).toBe('—');
  });

  it('si solo falla la tasa, el resumen empieza con mayúscula y no inventa faltantes', () => {
    const c = condicionDe({
      ...NO_CUMPLE,
      criterios: {
        propuestas: criterio(1000, 1240),
        empresas: criterio(3, 4),
        meses: criterio(3, 4),
      },
    });
    expect(c.resumen).toBe('La tasa de desacuerdo supera el límite de 0.50 %.');
  });
});
