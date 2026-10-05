import { describe, expect, it } from 'vitest';
import {
  respuestaBandeja,
  resumenBandeja,
  type RespuestaBandeja,
} from './bandeja';

const GUID_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const GUID_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const GUID_C = '123e4567-e89b-42d3-a456-426614174000';

/** Forma real del backend, con campos que el contrato omite a propósito. */
const respuestaReal = () => ({
  datos: [
    {
      movimientoId: GUID_A,
      fecha: '2026-09-02',
      monto: '1160.0000',
      descripcion: 'SPEI ACME SA DE CV',
      referencia: 'F-2291',
      moneda: 'MXN',
      estado: 'sugerencia',
      propuestasCount: 2,
      motivo: 'Mismo monto y fecha cercana',
      regla: 'monto_exacto',
      mejorPropuesta: {
        conciliacionId: GUID_B,
        score: '0.9500',
        regla: 'monto_exacto',
        motivo: 'Mismo monto',
        diferenciaMonto: '0.0000',
        cfdi: {
          id: GUID_C,
          uuidFiscal: 'A1B2C3D4-0000-4000-8000-000000000001',
          serie: 'A',
          folio: '1042',
          nombreEmisor: 'ACME',
          rfcReceptor: 'XAXX010101000',
          nombreReceptor: null,
          fechaEmision: '2026-09-01',
          total: '1160.0000',
          moneda: 'MXN',
          metodoPago: 'PUE',
        },
      },
    },
  ],
  pagina: 1,
  limite: 20,
  total: 1,
});

type Fila = Record<string, unknown> & {
  mejorPropuesta: Record<string, unknown> & { cfdi: Record<string, unknown> };
};
const conFila = (cambios: Record<string, unknown>) => {
  const base = respuestaReal();
  return { ...base, datos: [{ ...base.datos[0], ...cambios } as Fila] };
};

describe('respuestaBandeja', () => {
  it('acepta la forma real y conserva los montos como cadena exacta', () => {
    const r: RespuestaBandeja = respuestaBandeja.parse(respuestaReal());
    expect(r.datos[0]?.monto).toBe('1160.0000');
    expect(r.datos[0]?.mejorPropuesta?.diferenciaMonto).toBe('0.0000');
    expect(r.datos[0]?.mejorPropuesta?.cfdi.total).toBe('1160.0000');
    expect(r.total).toBe(1);
  });

  it('ignora los campos que la pantalla no usa', () => {
    const r = respuestaBandeja.parse(respuestaReal());
    expect(r.datos[0]?.mejorPropuesta).not.toHaveProperty('score');
    expect(r.datos[0]?.mejorPropuesta?.cfdi).not.toHaveProperty('rfcReceptor');
    expect(
      respuestaBandeja.safeParse({ ...respuestaReal(), extra: 1 }).success,
    ).toBe(true);
  });

  it('un campo omitido del contrato no puede romper la lista', () => {
    const base = respuestaReal();
    const sinAdicionales = {
      ...base,
      datos: [
        {
          ...base.datos[0],
          mejorPropuesta: {
            conciliacionId: GUID_B,
            diferenciaMonto: null,
            cfdi: {
              id: GUID_C,
              uuidFiscal: 'x',
              serie: null,
              folio: null,
              total: '1.0000',
              moneda: 'MXN',
            },
          },
        },
      ],
    };
    expect(respuestaBandeja.safeParse(sinAdicionales).success).toBe(true);
  });

  it.each(['monto', 'total', 'diferenciaMonto'])(
    'rechaza un número JSON en %s',
    (campo) => {
      const r = conFila({});
      const fila = r.datos[0]!;
      if (campo === 'monto') fila.monto = 1160 as unknown as string;
      else if (campo === 'total') fila.mejorPropuesta.cfdi.total = 1160;
      else fila.mejorPropuesta.diferenciaMonto = 0;
      expect(respuestaBandeja.safeParse(r).success).toBe(false);
    },
  );

  it('rechaza un total numérico de la página', () => {
    expect(
      respuestaBandeja.safeParse({ ...respuestaReal(), total: '1' }).success,
    ).toBe(false);
  });

  it('rechaza un estado desconocido', () => {
    expect(
      respuestaBandeja.safeParse(conFila({ estado: 'borrado' })).success,
    ).toBe(false);
  });

  it.each(['conciliado', 'sugerencia', 'sin_match'])(
    'acepta el estado %s',
    (estado) => {
      expect(respuestaBandeja.safeParse(conFila({ estado })).success).toBe(
        true,
      );
    },
  );

  it('rechaza un movimientoId que no es guid', () => {
    expect(
      respuestaBandeja.safeParse(conFila({ movimientoId: '../admin' })).success,
    ).toBe(false);
  });

  it('acepta nulos en referencia, regla, motivo y mejor propuesta', () => {
    const r = respuestaBandeja.safeParse(
      conFila({
        referencia: null,
        regla: null,
        motivo: null,
        mejorPropuesta: null,
        estado: 'sin_match',
      }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta diferenciaMonto nula', () => {
    const r = conFila({});
    r.datos[0]!.mejorPropuesta.diferenciaMonto = null;
    expect(respuestaBandeja.safeParse(r).success).toBe(true);
  });

  it('acepta cualquier uuidFiscal no vacío y rechaza el vacío', () => {
    const r = conFila({});
    r.datos[0]!.mejorPropuesta.cfdi.uuidFiscal = 'no-es-un-uuid';
    expect(respuestaBandeja.safeParse(r).success).toBe(true);
    r.datos[0]!.mejorPropuesta.cfdi.uuidFiscal = '';
    expect(respuestaBandeja.safeParse(r).success).toBe(false);
  });

  it('rechaza una fecha que no es AAAA-MM-DD', () => {
    expect(
      respuestaBandeja.safeParse(conFila({ fecha: '02/09/2026' })).success,
    ).toBe(false);
  });

  it('rechaza una moneda que no es de tres letras', () => {
    expect(
      respuestaBandeja.safeParse(conFila({ moneda: 'PESOS' })).success,
    ).toBe(false);
  });

  it('rechaza un limite mayor al máximo del backend y página o total inválidos', () => {
    const base = respuestaReal();
    expect(respuestaBandeja.safeParse({ ...base, limite: 201 }).success).toBe(
      false,
    );
    expect(respuestaBandeja.safeParse({ ...base, limite: 200 }).success).toBe(
      true,
    );
    expect(respuestaBandeja.safeParse({ ...base, pagina: 0 }).success).toBe(
      false,
    );
    expect(respuestaBandeja.safeParse({ ...base, total: -1 }).success).toBe(
      false,
    );
    expect(respuestaBandeja.safeParse({ ...base, total: 1.5 }).success).toBe(
      false,
    );
  });

  it('rechaza propuestasCount negativo', () => {
    expect(
      respuestaBandeja.safeParse(conFila({ propuestasCount: -1 })).success,
    ).toBe(false);
  });

  it('acepta una página vacía', () => {
    expect(
      respuestaBandeja.safeParse({ ...respuestaReal(), datos: [], total: 0 })
        .success,
    ).toBe(true);
  });
});

describe('resumenBandeja', () => {
  const resumen = () => ({
    conteos: { conciliado: 3, sugerencia: 25, sin_match: 16 },
    montoPorRevisar: [
      { moneda: 'MXN', monto: '847688.4300' },
      { moneda: 'USD', monto: '2150.0000' },
    ],
  });

  it('acepta la forma real y conserva los montos de cuatro decimales', () => {
    const r = resumenBandeja.parse(resumen());
    expect(r.conteos.sugerencia).toBe(25);
    expect(r.montoPorRevisar[0]?.monto).toBe('847688.4300');
    expect(r.montoPorRevisar[1]?.monto).toBe('2150.0000');
  });

  it('acepta montoPorRevisar vacío', () => {
    expect(
      resumenBandeja.safeParse({ ...resumen(), montoPorRevisar: [] }).success,
    ).toBe(true);
  });

  it('rechaza un conteo faltante (sin_match)', () => {
    const r = resumen();
    const conteos: Record<string, number> = { ...r.conteos };
    delete conteos.sin_match;
    expect(resumenBandeja.safeParse({ ...r, conteos }).success).toBe(false);
  });

  it('rechaza un conteo negativo o no entero', () => {
    const r = resumen();
    expect(
      resumenBandeja.safeParse({
        ...r,
        conteos: { ...r.conteos, conciliado: -1 },
      }).success,
    ).toBe(false);
    expect(
      resumenBandeja.safeParse({
        ...r,
        conteos: { ...r.conteos, conciliado: 1.5 },
      }).success,
    ).toBe(false);
  });

  it('rechaza un estado desconocido en conteos', () => {
    const r = resumen();
    expect(
      resumenBandeja.safeParse({ ...r, conteos: { ...r.conteos, borrado: 1 } })
        .success,
    ).toBe(false);
  });

  it('rechaza un monto numérico o una moneda inválida', () => {
    const r = resumen();
    expect(
      resumenBandeja.safeParse({
        ...r,
        montoPorRevisar: [{ moneda: 'MXN', monto: 847688.43 }],
      }).success,
    ).toBe(false);
    expect(
      resumenBandeja.safeParse({
        ...r,
        montoPorRevisar: [{ moneda: 'MX', monto: '1.0000' }],
      }).success,
    ).toBe(false);
  });
});
