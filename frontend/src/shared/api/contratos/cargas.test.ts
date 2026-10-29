import { describe, expect, it } from 'vitest';
import { ContratoError } from '@/shared/api';
import { ESTADOS_CARGA } from '@/shared/dominio';
import {
  detalleCarga,
  perfilesBancarios,
  respuestaCarga,
  respuestaLecturaPdf,
  respuestaListaCargas,
  type ItemCarga,
  type RespuestaCarga,
} from './cargas';

const G = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Forma real de GET /cargas, con claves que el contrato ignora. */
const item = (n: number, o: Record<string, unknown> = {}) => ({
  id: G(n),
  tipo: 'cfdi',
  nombreArchivo: `lote-${n}.xml`,
  estado: 'procesada',
  totalRegistros: 4,
  registrosOk: 3,
  registrosExistentes: 1,
  registrosError: 0,
  banco: null,
  perfil: null,
  errorMensaje: null,
  subidoPor: 'Ana Reyes',
  createdAt: '2026-10-05T10:00:00.000Z',
  procesadaAt: '2026-10-05T10:00:03.000Z',
  ...o,
});

/** Cuerpo de GET /cargas/:id; el POST le suma `yaExistia`. */
const detalle = (o: Record<string, unknown> = {}) => ({
  id: G(1),
  estado: 'con_errores',
  totalRegistros: 3,
  registrosOk: 1,
  registrosExistentes: 1,
  registrosError: 1,
  resultados: [
    { archivo: 'a.xml', resultado: 'nuevo' },
    { archivo: 'b.xml', resultado: 'ya_existia' },
    { archivo: 'c.xml', resultado: 'error', motivo: 'XML mal formado' },
  ],
  errorMensaje: null,
  ...o,
});

describe('respuestaListaCargas (API-18a)', () => {
  it('conserva monedaNoSoportada del servidor (historia 3.1)', () => {
    const [c] = respuestaListaCargas.parse({
      datos: [item(1, { monedaNoSoportada: 2 })],
    }).datos;
    expect(c?.monedaNoSoportada).toBe(2);
  });

  it('una respuesta sin monedaNoSoportada se lee como 0', () => {
    const [c] = respuestaListaCargas.parse({ datos: [item(1)] }).datos;
    expect(c?.monedaNoSoportada).toBe(0);
  });

  it.each([[-1], [1.5], ['2'], [null], [true]])(
    'monedaNoSoportada %j es un ContratoError',
    (valor) => {
      expect(
        respuestaListaCargas.safeParse({
          datos: [item(1, { monedaNoSoportada: valor })],
        }).success,
      ).toBe(false);
    },
  );

  it('acepta una lista con los cinco estados', () => {
    const datos = ESTADOS_CARGA.map((estado, i) => item(i + 1, { estado }));
    const parsed = respuestaListaCargas.parse({ datos });
    expect(parsed.datos.map((c) => c.estado)).toEqual([...ESTADOS_CARGA]);
  });

  it('acepta un estado de cuenta, la lista vacía y quien subió en null', () => {
    expect(
      respuestaListaCargas.parse({
        datos: [item(1, { tipo: 'estado_cuenta', subidoPor: null })],
      }).datos[0]?.subidoPor,
    ).toBeNull();
    expect(respuestaListaCargas.parse({ datos: [] })).toEqual({ datos: [] });
  });

  it('rechaza un estado que no es del backend (K1: "completada")', () => {
    const r = respuestaListaCargas.safeParse({
      datos: [item(1, { estado: 'completada' })],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un tipo desconocido', () => {
    expect(
      respuestaListaCargas.safeParse({ datos: [item(1, { tipo: 'xlsx' })] })
        .success,
    ).toBe(false);
  });

  it('ignora claves de más y no las expone', () => {
    const [primera] = respuestaListaCargas.parse({
      datos: [item(1, { secreto: 'x' })],
    }).datos;
    expect(primera).toBeDefined();
    expect(Object.keys(primera as ItemCarga).sort()).toEqual([
      'createdAt',
      'estado',
      'id',
      'monedaNoSoportada',
      'nombreArchivo',
      'registrosError',
      'registrosOk',
      'subidoPor',
      'tipo',
    ]);
  });

  it('un contador como cadena falla; también uno negativo o decimal', () => {
    for (const malo of ['3', -1, 1.5]) {
      expect(
        respuestaListaCargas.safeParse({
          datos: [item(1, { registrosOk: malo })],
        }).success,
      ).toBe(false);
    }
  });

  it('exige envoltorio, id uuid y fecha ISO', () => {
    expect(respuestaListaCargas.safeParse([item(1)]).success).toBe(false);
    expect(
      respuestaListaCargas.safeParse({ datos: [item(1, { id: 'x' })] }).success,
    ).toBe(false);
    expect(
      respuestaListaCargas.safeParse({
        datos: [item(1, { createdAt: 'ayer' })],
      }).success,
    ).toBe(false);
  });
});

describe('detalleCarga y respuestaCarga (API-18b)', () => {
  it('CFDI con archivos nuevo, ya_existia y error con motivo', () => {
    const d = detalleCarga.parse(detalle());
    expect(d.resultados).toEqual([
      { archivo: 'a.xml', resultado: 'nuevo' },
      { archivo: 'b.xml', resultado: 'ya_existia' },
      { archivo: 'c.xml', resultado: 'error', motivo: 'XML mal formado' },
    ]);
  });

  it('CSV con errores de fila: cada elemento conserva su forma', () => {
    const d = detalleCarga.parse(
      detalle({
        resultados: [
          { fila: 4, resultado: 'error', motivo: 'Monto inválido' },
          { fila: 17, resultado: 'error', motivo: 'Fecha vacía' },
        ],
      }),
    );
    expect(d.resultados).toEqual([
      { fila: 4, resultado: 'error', motivo: 'Monto inválido' },
      { fila: 17, resultado: 'error', motivo: 'Fecha vacía' },
    ]);
  });

  it('mezcla de formas válida; un error sin motivo falla', () => {
    expect(
      detalleCarga.safeParse(
        detalle({
          resultados: [
            { fila: 4, resultado: 'error', motivo: 'm' },
            { archivo: 'a.xml', resultado: 'nuevo' },
          ],
        }),
      ).success,
    ).toBe(true);
    expect(
      detalleCarga.safeParse(
        detalle({ resultados: [{ archivo: 'a.xml', resultado: 'error' }] }),
      ).success,
    ).toBe(false);
    expect(
      detalleCarga.safeParse(
        detalle({ resultados: [{ fila: 4, resultado: 'error' }] }),
      ).success,
    ).toBe(false);
  });

  it('un resultado desconocido falla', () => {
    expect(
      detalleCarga.safeParse(
        detalle({ resultados: [{ archivo: 'a.xml', resultado: 'omitido' }] }),
      ).success,
    ).toBe(false);
  });

  it('pendiente con resultados vacíos y fallida con errorMensaje', () => {
    expect(
      detalleCarga.parse(detalle({ estado: 'pendiente', resultados: [] }))
        .resultados,
    ).toEqual([]);
    expect(
      detalleCarga.parse(
        detalle({ estado: 'fallida', errorMensaje: 'No se pudo procesar' }),
      ).errorMensaje,
    ).toBe('No se pudo procesar');
  });

  it('un estado desconocido y un contador como cadena fallan', () => {
    expect(
      detalleCarga.safeParse(detalle({ estado: 'completada' })).success,
    ).toBe(false);
    expect(detalleCarga.safeParse(detalle({ registrosOk: '3' })).success).toBe(
      false,
    );
    expect(
      detalleCarga.safeParse(detalle({ registrosExistentes: '1' })).success,
    ).toBe(false);
  });

  it('`yaExistia` solo existe en la respuesta del POST', () => {
    const post: RespuestaCarga = respuestaCarga.parse(
      detalle({ yaExistia: true }),
    );
    expect(post.yaExistia).toBe(true);
    expect(respuestaCarga.safeParse(detalle()).success).toBe(false);
    expect(respuestaCarga.safeParse(detalle({ yaExistia: 'si' })).success).toBe(
      false,
    );
    expect(detalleCarga.parse(detalle({ yaExistia: true }))).not.toHaveProperty(
      'yaExistia',
    );
  });

  it('ignora claves de más y no las expone', () => {
    const d = detalleCarga.parse(detalle({ hashArchivo: 'x', cuenta: '1' }));
    expect(d).not.toHaveProperty('hashArchivo');
    expect(d).not.toHaveProperty('cuenta');
  });
});

describe('perfilesBancarios (API-18c)', () => {
  it('acepta cuadra, banco-norte y banco-sur', () => {
    const perfiles = perfilesBancarios.parse([
      { id: 'cuadra', nombre: 'Cuadra' },
      { id: 'banco-norte', nombre: 'Banco Norte' },
      { id: 'banco-sur', nombre: 'Banco Sur' },
    ]);
    expect(perfiles.map((p) => p.id)).toEqual([
      'cuadra',
      'banco-norte',
      'banco-sur',
    ]);
  });

  it('rechaza un perfil sin id y lo que no es un arreglo', () => {
    expect(perfilesBancarios.safeParse([{ nombre: 'x' }]).success).toBe(false);
    expect(perfilesBancarios.safeParse({ datos: [] }).success).toBe(false);
  });
});

describe('ContratoError', () => {
  it('es la clase con la que el cliente reporta un cuerpo fuera de contrato', () => {
    const r = respuestaListaCargas.safeParse({ datos: 'no' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const error = new ContratoError(r.error);
      expect(error).toBeInstanceOf(ContratoError);
      expect(error.detalle).toBe(r.error);
    }
  });
});

describe('resultados de CFDI con moneda no soportada (historia 3.1)', () => {
  const marcado = {
    archivo: 'usd.xml',
    resultado: 'nuevo',
    moneda: 'USD',
    monedaNoSoportada: true,
  };

  it('conserva moneda y monedaNoSoportada cuando vienen', () => {
    const d = detalleCarga.parse(
      detalle({
        estado: 'procesada',
        resultados: [
          marcado,
          { ...marcado, archivo: 'b.xml', resultado: 'ya_existia' },
        ],
      }),
    );
    expect(d.resultados[0]).toEqual(marcado);
    expect(d.resultados[1]).toMatchObject({
      resultado: 'ya_existia',
      moneda: 'USD',
      monedaNoSoportada: true,
    });
  });

  it('un archivo sin marca sigue siendo válido y no inventa las claves', () => {
    const d = detalleCarga.parse(detalle());
    expect(d.resultados[0]).toEqual({ archivo: 'a.xml', resultado: 'nuevo' });
    expect(d.resultados[0]).not.toHaveProperty('moneda');
    expect(d.resultados[0]).not.toHaveProperty('monedaNoSoportada');
  });

  it('una marca mal formada es ContratoError-able: falla el contrato', () => {
    for (const mala of [
      { moneda: 'US' },
      { moneda: 'DÓLAR' },
      { moneda: 840 },
      { monedaNoSoportada: 'true' },
      { monedaNoSoportada: 1 },
    ]) {
      expect(
        detalleCarga.safeParse(
          detalle({ resultados: [{ ...marcado, ...mala }] }),
        ).success,
      ).toBe(false);
    }
  });
});

describe('respuestaLecturaPdf (historia 3.2)', () => {
  const lectura = {
    banco: 'bbva',
    saldoInicial: '10000.00',
    saldoFinal: '11250.50',
    movimientosLeidos: 14,
    lineasNoLeidas: 0,
    cargaId: G(7),
    estado: 'pendiente_vista_previa',
    yaExistia: false,
  };

  it('exige la carga guardada, su estado y si ya existía (historia 3.3)', () => {
    for (const faltante of ['cargaId', 'estado', 'yaExistia']) {
      expect(() =>
        respuestaLecturaPdf.parse({ ...lectura, [faltante]: undefined }),
      ).toThrow();
    }
    expect(() =>
      respuestaLecturaPdf.parse({ ...lectura, estado: 'otro' }),
    ).toThrow();
  });

  it('conserva los saldos como cadenas decimales exactas', () => {
    const r = respuestaLecturaPdf.parse(lectura);
    expect(r).toEqual(lectura);
    expect(typeof r.saldoInicial).toBe('string');
    const grande = respuestaLecturaPdf.parse({
      ...lectura,
      saldoFinal: '12345678901234567.89',
    });
    expect(grande.saldoFinal).toBe('12345678901234567.89');
  });

  it('un saldo numérico, vacío o con separadores falla', () => {
    for (const saldoInicial of [10000, '', '10,000.00', '1e3']) {
      expect(() =>
        respuestaLecturaPdf.parse({ ...lectura, saldoInicial }),
      ).toThrow();
    }
  });

  it('los conteos son enteros no negativos', () => {
    for (const parche of [
      { movimientosLeidos: -1 },
      { lineasNoLeidas: 1.5 },
      { movimientosLeidos: '14' },
    ]) {
      expect(() =>
        respuestaLecturaPdf.parse({ ...lectura, ...parche }),
      ).toThrow();
    }
  });

  it('ignora claves de más y exige las propias', () => {
    expect(
      respuestaLecturaPdf.parse({ ...lectura, extra: 1 }),
    ).not.toHaveProperty('extra');
    expect(() =>
      respuestaLecturaPdf.parse({ ...lectura, banco: undefined }),
    ).toThrow();
  });
});
