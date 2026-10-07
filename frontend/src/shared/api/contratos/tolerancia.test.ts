import { describe, expect, it } from 'vitest';
import { CAMPO_TOLERANCIA } from '@/shared/dominio';
import {
  cambioTolerancia,
  extraerCambiosTolerancia,
  respuestaBitacoraCruda,
  respuestaTolerancia,
  toleranciaDecimal,
} from './tolerancia';

const G = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Forma real de un evento de GET /bitacora, con claves que el contrato ignora. */
const evento = (n: number, o: Record<string, unknown> = {}) => ({
  id: G(n),
  entidad: 'companies',
  entidadId: G(1),
  accion: 'actualizar',
  datos: { campo: CAMPO_TOLERANCIA, antes: '0.5000', despues: '0.7500' },
  createdAt: '2026-10-05T10:00:00.000Z',
  usuario: { nombre: 'Ana Mendoza', email: 'ana@cuadra.mx' },
  ip: '127.0.0.1',
  userAgent: 'vitest',
  ...o,
});

describe('toleranciaDecimal (encadena sobre montoDecimal)', () => {
  it('el encadenado de zod 4 conserva ambas reglas: la de montoDecimal y la del patrón', () => {
    // "1.23456" cumple el patrón decimal general pero no el del servidor
    // (hasta 4 decimales); "-1" y "1e3" no cumplen ninguno.
    expect(toleranciaDecimal.safeParse('1.2345').success).toBe(true);
    expect(toleranciaDecimal.safeParse('1.23456').success).toBe(false);
    expect(toleranciaDecimal.safeParse('-1').success).toBe(false);
    expect(toleranciaDecimal.safeParse('1e3').success).toBe(false);
    expect(toleranciaDecimal.safeParse('').success).toBe(false);
  });
});

describe('respuestaTolerancia (TOL-1.6)', () => {
  it.each(['0.5000', '100.0000', '0.0000'])('acepta "%s"', (valor) => {
    expect(respuestaTolerancia.parse({ toleranciaMonto: valor })).toEqual({
      toleranciaMonto: valor,
    });
  });

  it.each([
    ['un número JSON', 0.5],
    ['texto no decimal', 'abc'],
    ['un negativo', '-0.5000'],
    ['notación científica', '1e1'],
    ['cinco decimales', '0.12345'],
    ['null', null],
  ])('rechaza %s', (_nombre, valor) => {
    expect(
      respuestaTolerancia.safeParse({ toleranciaMonto: valor }).success,
    ).toBe(false);
  });

  it('rechaza la clave ausente', () => {
    expect(respuestaTolerancia.safeParse({}).success).toBe(false);
  });

  it('ignora claves desconocidas', () => {
    expect(
      respuestaTolerancia.parse({ toleranciaMonto: '1.0000', otra: 1 }),
    ).toEqual({ toleranciaMonto: '1.0000' });
  });
});

describe('cambioTolerancia', () => {
  it('acepta un evento real y descarta lo que no usa', () => {
    expect(cambioTolerancia.parse(evento(2))).toEqual({
      id: G(2),
      createdAt: '2026-10-05T10:00:00.000Z',
      usuario: { nombre: 'Ana Mendoza' },
      datos: { campo: CAMPO_TOLERANCIA, antes: '0.5000', despues: '0.7500' },
    });
  });

  it('acepta usuario null', () => {
    expect(cambioTolerancia.parse(evento(3, { usuario: null })).usuario).toBe(
      null,
    );
  });

  it.each([
    ['id que no es guid', { id: 'abc' }],
    ['createdAt que no es ISO', { createdAt: 'ayer' }],
    ['usuario sin nombre', { usuario: {} }],
    ['otro campo', { datos: { campo: 'otro', antes: '1', despues: '2' } }],
    ['datos null', { datos: null }],
    [
      'antes numérico',
      { datos: { campo: CAMPO_TOLERANCIA, antes: 5, despues: '1.0000' } },
    ],
    [
      'despues con cinco decimales',
      {
        datos: { campo: CAMPO_TOLERANCIA, antes: '1.0000', despues: '0.12345' },
      },
    ],
  ])('rechaza %s', (_nombre, parche) => {
    expect(cambioTolerancia.safeParse(evento(4, parche)).success).toBe(false);
  });
});

describe('respuestaBitacoraCruda', () => {
  it('exige el arreglo datos y deja pasar su contenido sin validarlo', () => {
    const cuerpo = { datos: [1, 'x', null], pagina: 1, limite: 50, total: 3 };
    expect(respuestaBitacoraCruda.parse(cuerpo).datos).toEqual([1, 'x', null]);
  });

  it('rechaza un sobre sin arreglo datos (el cliente lo eleva a ContratoError)', () => {
    expect(respuestaBitacoraCruda.safeParse({ pagina: 1 }).success).toBe(false);
    expect(respuestaBitacoraCruda.safeParse({ datos: 'no' }).success).toBe(
      false,
    );
  });
});

describe('extraerCambiosTolerancia (TOL-10.7, TOL-10.13)', () => {
  it('omite otro campo, datos null, cinco decimales, antes numérico y filas heredadas', () => {
    const filas = [
      evento(1, {
        datos: { campo: 'otro', antes: '1.0000', despues: '2.0000' },
      }),
      evento(2, { datos: null }),
      evento(3, {
        datos: { campo: CAMPO_TOLERANCIA, antes: '0.00001', despues: '1.0000' },
      }),
      evento(4, {
        datos: { campo: CAMPO_TOLERANCIA, antes: 5, despues: '1.0000' },
      }),
      evento(5, { datos: { origen: 'regla' } }),
      'no es un objeto',
      null,
    ];
    expect(extraerCambiosTolerancia(filas)).toEqual([]);
  });

  it('conserva la fila con usuario null y el orden del servidor', () => {
    const filas = [
      evento(7, { usuario: null }),
      evento(1, { datos: null }),
      evento(6),
      evento(5),
    ];
    expect(extraerCambiosTolerancia(filas).map((c) => c.id)).toEqual([
      G(7),
      G(6),
      G(5),
    ]);
    expect(extraerCambiosTolerancia(filas)[0]?.usuario).toBeNull();
  });

  it('recorta a los primeros cinco coincidentes', () => {
    const filas = Array.from({ length: 9 }, (_, i) => evento(i + 10));
    expect(extraerCambiosTolerancia(filas).map((c) => c.id)).toEqual([
      G(10),
      G(11),
      G(12),
      G(13),
      G(14),
    ]);
  });

  it('respeta un máximo explícito', () => {
    const filas = Array.from({ length: 4 }, (_, i) => evento(i + 10));
    expect(extraerCambiosTolerancia(filas, 2)).toHaveLength(2);
  });

  it('con menos de cinco devuelve las que hay', () => {
    const filas = [evento(1), evento(2, { datos: null }), evento(3)];
    expect(extraerCambiosTolerancia(filas)).toHaveLength(2);
  });
});
