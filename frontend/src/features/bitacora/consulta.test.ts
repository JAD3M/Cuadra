import { describe, expect, it } from 'vitest';
import { LIMITE_MAXIMO } from '@/shared/dominio';
import { LIMITE_PAGINA } from './constantes';
import { armarConsulta, rutaBitacora } from './consulta';
import { inicioDelDia, inicioDelDiaSiguiente } from './fechas';

const UUID = '3f2b7c1e-9a4d-4e6b-8c15-2d7a90b4e1f3';

// Mismo acceso tipado al entorno que `fechas.test.ts`: `src` no declara los
// tipos de Node.
const entorno = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;

describe('LIMITE_PAGINA', () => {
  it('es 50 y nunca pasa del máximo del backend', () => {
    expect(LIMITE_PAGINA).toBe(50);
    expect(LIMITE_PAGINA).toBeLessThanOrEqual(LIMITE_MAXIMO);
  });
});

describe('armarConsulta', () => {
  it('sin filtros pide la página 1 con el límite fijo', () => {
    expect(armarConsulta({ pagina: 1 })).toEqual({ pagina: 1, limite: 50 });
  });

  it('mapea usuario a userId y conserva entidad, accion y página', () => {
    expect(
      armarConsulta({
        entidad: 'companies',
        accion: 'actualizar',
        usuario: UUID,
        pagina: 3,
      }),
    ).toEqual({
      entidad: 'companies',
      accion: 'actualizar',
      userId: UUID,
      pagina: 3,
      limite: 50,
    });
  });

  it('desde es el inicio del día local y hasta el inicio del día local siguiente', () => {
    const consulta = armarConsulta({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      pagina: 1,
    });
    expect(consulta).toEqual({
      desde: inicioDelDia('2026-09-01'),
      hasta: inicioDelDiaSiguiente('2026-09-30'),
      pagina: 1,
      limite: 50,
    });
  });

  it('el mismo día en ambos lados pide ese día completo, no un 400 (BIT-7.2)', () => {
    const consulta = armarConsulta({
      desde: '2026-09-30',
      hasta: '2026-09-30',
      pagina: 1,
    });
    expect(consulta).not.toBeNull();
    expect(consulta?.desde).toBe(inicioDelDia('2026-09-30'));
    expect(consulta?.hasta).toBe(inicioDelDiaSiguiente('2026-09-30'));
    expect(consulta?.desde).not.toBe(consulta?.hasta);
  });

  it('en Ciudad de México los instantes salen con literales (UTC-6)', () => {
    const zona = entorno.TZ;
    entorno.TZ = 'America/Mexico_City';
    try {
      expect(
        armarConsulta({ desde: '2026-09-30', hasta: '2026-09-30', pagina: 1 }),
      ).toEqual({
        desde: '2026-09-30T06:00:00.000Z',
        hasta: '2026-10-01T06:00:00.000Z',
        pagina: 1,
        limite: 50,
      });
    } finally {
      if (zona === undefined) delete entorno.TZ;
      else entorno.TZ = zona;
    }
  });

  it('solo Hasta manda solo hasta (BIT-6.12)', () => {
    const consulta = armarConsulta({ hasta: '2026-09-30', pagina: 1 });
    expect(consulta).toEqual({
      hasta: inicioDelDiaSiguiente('2026-09-30'),
      pagina: 1,
      limite: 50,
    });
    expect(consulta).not.toHaveProperty('desde');
  });

  it('solo Desde manda solo desde', () => {
    const consulta = armarConsulta({ desde: '2026-09-01', pagina: 1 });
    expect(consulta).toEqual({
      desde: inicioDelDia('2026-09-01'),
      pagina: 1,
      limite: 50,
    });
    expect(consulta).not.toHaveProperty('hasta');
  });

  it('un rango invertido no tiene consulta: no se envía nada', () => {
    expect(
      armarConsulta({ desde: '2026-09-30', hasta: '2026-09-01', pagina: 1 }),
    ).toBeNull();
  });

  it('las claves ausentes no aparecen ni como undefined', () => {
    expect(Object.keys(armarConsulta({ pagina: 2 }) ?? {})).toEqual([
      'pagina',
      'limite',
    ]);
  });
});

describe('rutaBitacora', () => {
  it('sin filtros manda siempre pagina y limite', () => {
    expect(rutaBitacora({ pagina: 1, limite: 50 })).toBe(
      '/bitacora?pagina=1&limite=50',
    );
  });

  it('usa el orden fijo entidad, accion, userId, desde, hasta, pagina, limite', () => {
    expect(
      rutaBitacora({
        limite: 50,
        pagina: 2,
        hasta: '2026-10-01T06:00:00.000Z',
        desde: '2026-09-01T06:00:00.000Z',
        userId: UUID,
        accion: 'actualizar',
        entidad: 'companies',
      }),
    ).toBe(
      `/bitacora?entidad=companies&accion=actualizar&userId=${UUID}` +
        '&desde=2026-09-01T06%3A00%3A00.000Z&hasta=2026-10-01T06%3A00%3A00.000Z' +
        '&pagina=2&limite=50',
    );
  });

  it('los filtros ausentes nunca se envían', () => {
    const ruta = rutaBitacora({ accion: 'crear', pagina: 1, limite: 50 });
    expect(ruta).toBe('/bitacora?accion=crear&pagina=1&limite=50');
    expect(ruta).not.toMatch(/entidad|userId|desde|hasta/);
  });

  it('el límite que arma la consulta es el que viaja', () => {
    const consulta = armarConsulta({ pagina: 4 });
    expect(consulta).not.toBeNull();
    if (consulta === null) return;
    expect(rutaBitacora(consulta)).toBe('/bitacora?pagina=4&limite=50');
  });
});
