import type { EntityManager } from 'typeorm';
import { separacionActiva } from './separacion-funciones';

const managerCon = (query: jest.Mock) =>
  ({ query }) as unknown as EntityManager;

describe('separacionActiva (AD-13, falla cerrada)', () => {
  const lee = (filas: unknown) =>
    jest
      .fn()
      .mockImplementation((sql: string) =>
        sql.startsWith('SELECT') ? Promise.resolve(filas) : Promise.resolve([]),
      );

  it('false explícito la desactiva', async () => {
    const query = lee([{ separacion_funciones: false }]);
    expect(await separacionActiva(managerCon(query), 'c1')).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      ['c1'],
    );
  });

  it('true la deja activa', async () => {
    expect(
      await separacionActiva(
        managerCon(lee([{ separacion_funciones: true }])),
        'c1',
      ),
    ).toBe(true);
  });

  it.each([
    ['la fila no existe', []],
    ['el valor es null', [{ separacion_funciones: null }]],
    ['el valor no es booleano', [{ separacion_funciones: 'f' }]],
  ])('%s: se aplica la separación', async (_caso, filas) => {
    expect(await separacionActiva(managerCon(lee(filas)), 'c1')).toBe(true);
  });

  it('si la lectura falla, se aplica la separación y se deshace el savepoint', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string) =>
        sql.startsWith('SELECT')
          ? Promise.reject(new Error('boom'))
          : Promise.resolve([]),
      );
    expect(await separacionActiva(managerCon(query), 'c1')).toBe(true);
    expect(query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT leer_separacion');
  });
});
