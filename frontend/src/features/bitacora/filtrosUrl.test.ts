import { describe, expect, it } from 'vitest';
import { ACCION_ACTUALIZAR, ENTIDAD_EMPRESA } from '@/shared/dominio';
import {
  cambiar,
  esPorDefecto,
  leerFiltros,
  serializar,
  type FiltrosBitacora,
} from './filtrosUrl';

const leer = (consulta: string) => leerFiltros(new URLSearchParams(consulta));
const POR_DEFECTO: FiltrosBitacora = { pagina: 1 };
const UUID = '3f2b7c1e-9a4d-4e6b-8c15-2d7a90b4e1f3';

describe('leerFiltros: sin filtros', () => {
  it('una URL vacía da los valores por defecto', () => {
    expect(leer('')).toEqual(POR_DEFECTO);
  });

  it('las claves ajenas se ignoran', () => {
    expect(leer('estado=sugerencia&foo=bar&userId=' + UUID)).toEqual(
      POR_DEFECTO,
    );
  });
});

describe('leerFiltros: entidad', () => {
  it.each(['conciliaciones', 'companies'])('acepta %s', (entidad) => {
    expect(leer(`entidad=${entidad}`)).toEqual({ pagina: 1, entidad });
  });

  it.each(['tolerancias', 'Companies', '', 'conciliaciones%20'])(
    'descarta el valor inválido %j',
    (entidad) => {
      expect(leer(`entidad=${entidad}`)).toEqual(POR_DEFECTO);
    },
  );

  it('con duplicados gana el primero, válido o no', () => {
    expect(leer('entidad=companies&entidad=conciliaciones').entidad).toBe(
      'companies',
    );
    expect(
      leer('entidad=tolerancias&entidad=companies').entidad,
    ).toBeUndefined();
  });
});

describe('leerFiltros: accion', () => {
  it.each(['crear', 'confirmar', 'rechazar', 'actualizar', 'acceso_denegado'])(
    'acepta %s',
    (accion) => {
      expect(leer(`accion=${accion}`)).toEqual({ pagina: 1, accion });
    },
  );

  it.each(['borrar', 'CREAR', ''])(
    'descarta el valor inválido %j',
    (accion) => {
      expect(leer(`accion=${accion}`)).toEqual(POR_DEFECTO);
    },
  );

  it('con duplicados gana el primero', () => {
    expect(leer('accion=crear&accion=rechazar').accion).toBe('crear');
    expect(leer('accion=borrar&accion=crear').accion).toBeUndefined();
  });
});

describe('leerFiltros: usuario', () => {
  it('acepta un uuid en minúsculas', () => {
    expect(leer(`usuario=${UUID}`)).toEqual({ pagina: 1, usuario: UUID });
  });

  it.each([
    ['en mayúsculas', UUID.toUpperCase()],
    ['sin guiones', UUID.replaceAll('-', '')],
    ['con un carácter de más', `${UUID}0`],
    ['con un carácter no hexadecimal', UUID.replace('3f', 'zz')],
    ['vacío', ''],
    ['un nombre', 'ana'],
  ])('descarta el valor %s', (_caso, usuario) => {
    expect(leer(`usuario=${usuario}`)).toEqual(POR_DEFECTO);
  });

  it('con duplicados gana el primero', () => {
    const otro = '11111111-2222-4333-8444-555555555555';
    expect(leer(`usuario=${UUID}&usuario=${otro}`).usuario).toBe(UUID);
  });
});

describe('leerFiltros: desde y hasta', () => {
  it('acepta días reales', () => {
    expect(leer('desde=2026-09-01&hasta=2026-09-30')).toEqual({
      pagina: 1,
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
  });

  it.each(['2026-02-31', '2026-13-01', '26-1-1', '', '1999-12-31', 'ayer'])(
    'descarta %j en cada lado, de forma independiente',
    (dia) => {
      expect(leer(`desde=${dia}&hasta=2026-09-30`)).toEqual({
        pagina: 1,
        hasta: '2026-09-30',
      });
      expect(leer(`desde=2026-09-01&hasta=${dia}`)).toEqual({
        pagina: 1,
        desde: '2026-09-01',
      });
    },
  );

  it('con duplicados gana el primero', () => {
    expect(leer('desde=2026-09-01&desde=2026-09-02').desde).toBe('2026-09-01');
  });

  it('un rango invertido se conserva tal cual: la pantalla lo avisa', () => {
    expect(leer('desde=2026-09-30&hasta=2026-09-01')).toEqual({
      pagina: 1,
      desde: '2026-09-30',
      hasta: '2026-09-01',
    });
  });
});

describe('leerFiltros: pagina', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['999999', 999999],
  ])('acepta %s', (valor, esperada) => {
    expect(leer(`pagina=${valor}`).pagina).toBe(esperada);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '01', '1000000', '9999999999'])(
    'descarta %j y cae a 1',
    (valor) => {
      expect(leer(`pagina=${valor}`).pagina).toBe(1);
    },
  );

  it('con duplicados gana el primero', () => {
    expect(leer('pagina=2&pagina=3').pagina).toBe(2);
  });
});

describe('serializar', () => {
  it('los valores por defecto dan una cadena vacía', () => {
    expect(serializar(POR_DEFECTO)).toBe('');
  });

  it('usa el orden canónico: entidad, accion, usuario, desde, hasta, pagina', () => {
    expect(
      serializar({
        pagina: 3,
        hasta: '2026-09-30',
        desde: '2026-09-01',
        usuario: UUID,
        accion: 'crear',
        entidad: 'conciliaciones',
      }),
    ).toBe(
      `entidad=conciliaciones&accion=crear&usuario=${UUID}&desde=2026-09-01&hasta=2026-09-30&pagina=3`,
    );
  });

  it('omite la página 1 y las claves ausentes', () => {
    expect(serializar({ pagina: 1, accion: 'rechazar' })).toBe(
      'accion=rechazar',
    );
  });

  it('omite lo que no es válido en vez de escribirlo', () => {
    expect(
      serializar({
        pagina: 0,
        entidad: 'tolerancias' as never,
        usuario: 'ana',
        desde: '2026-02-31',
      }),
    ).toBe('');
    expect(serializar({ pagina: 1.5 })).toBe('');
  });

  it('es idempotente: leer y serializar de nuevo da la misma cadena', () => {
    const canonica = serializar(
      leer(
        `pagina=2&hasta=2026-09-30&entidad=companies&foo=1&accion=actualizar&usuario=${UUID}`,
      ),
    );
    expect(canonica).toBe(
      `entidad=companies&accion=actualizar&usuario=${UUID}&hasta=2026-09-30&pagina=2`,
    );
    expect(serializar(leer(canonica))).toBe(canonica);
  });

  it('el enlace de tolerancia (D16) es canónico', () => {
    expect(
      serializar({
        entidad: ENTIDAD_EMPRESA,
        accion: ACCION_ACTUALIZAR,
        pagina: 1,
      }),
    ).toBe('entidad=companies&accion=actualizar');
  });
});

describe('cambiar', () => {
  const BASE: FiltrosBitacora = {
    entidad: 'companies',
    accion: 'actualizar',
    usuario: UUID,
    desde: '2026-09-01',
    hasta: '2026-09-30',
    pagina: 4,
  };

  it.each([
    ['entidad', { entidad: 'conciliaciones' as const }],
    ['accion', { accion: 'crear' as const }],
    ['usuario', { usuario: '11111111-2222-4333-8444-555555555555' }],
    ['desde', { desde: '2026-09-02' }],
    ['hasta', { hasta: '2026-09-29' }],
  ])('cambiar %s vuelve a la página 1 y conserva lo demás', (clave, parche) => {
    const siguiente = cambiar(BASE, parche);
    expect(siguiente.pagina).toBe(1);
    expect(siguiente).toEqual({ ...BASE, ...parche, pagina: 1 });
    expect(Object.keys(parche)).toEqual([clave]);
  });

  it('un valor undefined borra ese filtro', () => {
    expect(cambiar(BASE, { accion: undefined })).toEqual({
      entidad: 'companies',
      accion: undefined,
      usuario: UUID,
      desde: '2026-09-01',
      hasta: '2026-09-30',
      pagina: 1,
    });
    expect(serializar(cambiar(BASE, { accion: undefined }))).not.toContain(
      'accion',
    );
  });

  it('un parche vacío también vuelve a la página 1', () => {
    expect(cambiar(BASE, {}).pagina).toBe(1);
  });

  it('no muta el original', () => {
    const copia = { ...BASE };
    cambiar(BASE, { entidad: 'conciliaciones' });
    expect(BASE).toEqual(copia);
  });
});

describe('esPorDefecto', () => {
  it('sin filtros y en la página 1 es por defecto', () => {
    expect(esPorDefecto(POR_DEFECTO)).toBe(true);
  });

  it.each([
    ['entidad', { pagina: 1, entidad: 'companies' as const }],
    ['accion', { pagina: 1, accion: 'crear' as const }],
    ['usuario', { pagina: 1, usuario: UUID }],
    ['desde', { pagina: 1, desde: '2026-09-01' }],
    ['hasta', { pagina: 1, hasta: '2026-09-30' }],
  ])('con %s no es por defecto', (_clave, filtros) => {
    expect(esPorDefecto(filtros)).toBe(false);
  });

  it('la página no cuenta como filtro', () => {
    expect(esPorDefecto({ pagina: 5 })).toBe(true);
  });
});
