import { describe, expect, it } from 'vitest';
import {
  respuestaCaso,
  respuestaHistorial,
  respuestaResolucion,
  type RespuestaCaso,
} from './caso';

const G = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Forma real de la API, con campos que el contrato ignora. */
const propuesta = (n: number, o: Record<string, unknown> = {}) => ({
  conciliacionId: G(100 + n),
  estado: 'propuesta',
  origen: 'regla',
  score: '0.9000',
  regla: 'monto_unico',
  motivo: 'Mismo monto',
  diferenciaMonto: '0.0000',
  confirmadaAt: null,
  confirmadaPor: null,
  cfdi: {
    id: G(200 + n),
    uuidFiscal: `A1B2C3D4-0000-4000-8000-${String(n).padStart(12, '0')}`,
    serie: 'A',
    folio: String(1000 + n),
    nombreEmisor: 'Emisor SA',
    rfcReceptor: 'XAXX010101000',
    nombreReceptor: null,
    fechaEmision: '2026-09-01',
    total: '1160.0000',
    moneda: 'MXN',
    metodoPago: 'PUE',
  },
  ...o,
});

const caso = (o: Record<string, unknown> = {}) => ({
  movimiento: {
    id: G(1),
    fecha: '2026-09-02',
    monto: '1160.0000',
    moneda: 'MXN',
    descripcion: 'SPEI recibido',
    referencia: null,
    estado: 'abierto',
  },
  estado: 'sugerencia',
  sinMatch: null,
  toleranciaMonto: '0.5000',
  propuestas: [propuesta(1)],
  ...o,
});

const confirmada = (o: Record<string, unknown> = {}) =>
  propuesta(1, {
    estado: 'confirmada',
    confirmadaAt: '2026-09-03T15:04:05.000Z',
    confirmadaPor: { nombre: 'Ana' },
    ...o,
  });

describe('respuestaCaso: fixtures con la forma de CAS-3', () => {
  it('acepta una sugerencia con una propuesta', () => {
    expect(respuestaCaso.safeParse(caso()).success).toBe(true);
  });

  it('acepta varias propuestas, con score nulo al final', () => {
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [
          propuesta(1),
          propuesta(2, { score: '0.7000' }),
          propuesta(3, { score: null }),
        ],
      }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta un sin_match con y sin registro', () => {
    for (const sinMatch of [
      { regla: 'sin_candidato_monto', motivo: 'Sin CFDI' },
      { regla: null, motivo: null },
    ]) {
      const r = respuestaCaso.safeParse(
        caso({ estado: 'sin_match', sinMatch, propuestas: [] }),
      );
      expect(r.success).toBe(true);
    }
  });

  it('acepta un conciliado con su confirmada', () => {
    const r = respuestaCaso.safeParse(
      caso({ estado: 'conciliado', propuestas: [confirmada()] }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta una propuesta de origen llm con regla llm_sugerencia', () => {
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [propuesta(1, { origen: 'llm', regla: 'llm_sugerencia' })],
      }),
    );
    expect(r.success).toBe(true);
  });

  it('acepta los opcionales del CFDI en null', () => {
    const base = propuesta(1);
    const r = respuestaCaso.safeParse(
      caso({
        propuestas: [
          {
            ...base,
            cfdi: {
              ...base.cfdi,
              serie: null,
              folio: null,
              nombreEmisor: null,
              nombreReceptor: null,
              metodoPago: null,
            },
          },
        ],
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe('respuestaCaso: dinero como cadena exacta', () => {
  it('conserva la precisión como texto (B1)', () => {
    const r = respuestaCaso.parse(
      caso({
        movimiento: {
          ...caso().movimiento,
          monto: '9007199254740993.1200',
        },
        propuestas: [propuesta(1, { diferenciaMonto: '-0.0040' })],
      }),
    ) as RespuestaCaso;
    expect(r.movimiento.monto).toBe('9007199254740993.1200');
    expect(r.propuestas[0]?.diferenciaMonto).toBe('-0.0040');
    expect(r.toleranciaMonto).toBe('0.5000');
  });

  it.each([
    [
      'monto',
      () => caso({ movimiento: { ...caso().movimiento, monto: 1160 } }),
    ],
    ['toleranciaMonto', () => caso({ toleranciaMonto: 0.5 })],
    [
      'diferenciaMonto',
      () => caso({ propuestas: [propuesta(1, { diferenciaMonto: 0 })] }),
    ],
    [
      'cfdi.total',
      () => {
        const p = propuesta(1);
        return caso({
          propuestas: [{ ...p, cfdi: { ...p.cfdi, total: 1160 } }],
        });
      },
    ],
  ])('rechaza %s como número', (_nombre, armar) => {
    expect(respuestaCaso.safeParse(armar()).success).toBe(false);
  });
});

describe('respuestaCaso: forma y dominio', () => {
  it('ignora claves desconocidas', () => {
    const r = respuestaCaso.safeParse({ ...caso(), extra: 1 });
    expect(r.success).toBe(true);
  });

  it('rechaza un estado desconocido', () => {
    expect(respuestaCaso.safeParse(caso({ estado: 'borrado' })).success).toBe(
      false,
    );
  });

  it('deja pasar una regla desconocida como texto', () => {
    const r = respuestaCaso.parse(
      caso({ propuestas: [propuesta(1, { regla: 'regla_nueva' })] }),
    ) as RespuestaCaso;
    expect(r.propuestas[0]?.regla).toBe('regla_nueva');
  });

  it('exige el origen y lo valida contra el espejo (B3)', () => {
    const sinOrigen: Record<string, unknown> = { ...propuesta(1) };
    delete sinOrigen.origen;
    expect(
      respuestaCaso.safeParse(caso({ propuestas: [sinOrigen] })).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({ propuestas: [propuesta(1, { origen: 'humano' })] }),
      ).success,
    ).toBe(false);
  });

  it('rechaza una fecha de movimiento que no es AAAA-MM-DD', () => {
    expect(
      respuestaCaso.safeParse(
        caso({ movimiento: { ...caso().movimiento, fecha: '02/09/2026' } }),
      ).success,
    ).toBe(false);
  });

  it('rechaza un conciliacionId que no es guid', () => {
    expect(
      respuestaCaso.safeParse(
        caso({ propuestas: [propuesta(1, { conciliacionId: '42' })] }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaCaso: coherencia entre estado y propuestas', () => {
  it('conciliado sin exactamente una confirmada falla', () => {
    expect(
      respuestaCaso.safeParse(caso({ estado: 'conciliado', propuestas: [] }))
        .success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({ estado: 'conciliado', propuestas: [propuesta(1)] }),
      ).success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'conciliado',
          propuestas: [confirmada(), confirmada({ conciliacionId: G(150) })],
        }),
      ).success,
    ).toBe(false);
  });

  it('sugerencia sin propuestas, o con una confirmada, falla', () => {
    expect(
      respuestaCaso.safeParse(caso({ estado: 'sugerencia', propuestas: [] }))
        .success,
    ).toBe(false);
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'sugerencia',
          propuestas: [propuesta(1), confirmada()],
        }),
      ).success,
    ).toBe(false);
  });

  it('sin_match con propuestas falla', () => {
    expect(
      respuestaCaso.safeParse(
        caso({
          estado: 'sin_match',
          sinMatch: null,
          propuestas: [propuesta(1)],
        }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaResolucion', () => {
  const resolucion = (o: Record<string, unknown> = {}) => ({
    id: G(101),
    estado: 'confirmada',
    cfdiId: G(201),
    movimientoId: G(1),
    motivo: null,
    confirmadaAt: '2026-09-03T15:04:05.000Z',
    rechazadasAutomaticamente: [G(102), G(103)],
    ...o,
  });

  it('acepta una confirmación con dos hermanas rechazadas', () => {
    const r = respuestaResolucion.parse(resolucion());
    expect(r.rechazadasAutomaticamente).toHaveLength(2);
  });

  it('acepta un rechazo con arreglo vacío y sin confirmadaAt', () => {
    const r = respuestaResolucion.safeParse(
      resolucion({
        estado: 'rechazada',
        confirmadaAt: null,
        rechazadasAutomaticamente: [],
        motivo: 'No corresponde',
      }),
    );
    expect(r.success).toBe(true);
  });

  it('rechaza el estado "propuesta"', () => {
    expect(
      respuestaResolucion.safeParse(resolucion({ estado: 'propuesta' }))
        .success,
    ).toBe(false);
  });

  it('rechaza ids hermanas que no son guid', () => {
    expect(
      respuestaResolucion.safeParse(
        resolucion({ rechazadasAutomaticamente: ['x'] }),
      ).success,
    ).toBe(false);
  });
});

describe('respuestaHistorial', () => {
  const evento = (o: Record<string, unknown> = {}) => ({
    id: G(900),
    entidad: 'conciliacion',
    entidadId: G(101),
    accion: 'crear',
    createdAt: '2026-09-03T15:04:05.000Z',
    usuario: { nombre: 'Ana', email: 'ana@fdb.mx' },
    datos: { ip: '10.0.0.1', ids: [G(1)] },
    ...o,
  });

  it('acepta un actor nulo (Sistema)', () => {
    const r = respuestaHistorial.parse({ datos: [evento({ usuario: null })] });
    expect(r.datos[0]?.usuario).toBeNull();
  });

  it('no expone datos, email ni ip', () => {
    const r = respuestaHistorial.parse({ datos: [evento()] });
    const texto = JSON.stringify(r);
    expect(texto).not.toContain('10.0.0.1');
    expect(texto).not.toContain('ana@fdb.mx');
    expect(r.datos[0]).not.toHaveProperty('datos');
  });

  it('deja pasar una acción desconocida como texto', () => {
    const r = respuestaHistorial.parse({
      datos: [evento({ accion: 'accion_nueva' })],
    });
    expect(r.datos[0]?.accion).toBe('accion_nueva');
  });

  it('acepta una lista vacía y rechaza una fecha inválida', () => {
    expect(respuestaHistorial.safeParse({ datos: [] }).success).toBe(true);
    expect(
      respuestaHistorial.safeParse({
        datos: [evento({ createdAt: 'ayer' })],
      }).success,
    ).toBe(false);
  });
});
