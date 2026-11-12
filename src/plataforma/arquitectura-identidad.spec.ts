import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  type ArchivoFuente,
  buscarEscriturasIdentidad,
  EXCEPCIONES_IDENTIDAD,
} from './arquitectura';

/**
 * AD-2, clase 2 (identidad): solo los módulos de identidad (`auth`,
 * `companies`, `usuarios`, `invitaciones`, `recuperacion`, `plataforma`) y dos
 * archivos de infraestructura nombrados escriben esas tablas. Leerlas (SELECT,
 * JOIN) está permitido a todos. Las migraciones y los specs quedan fuera.
 */
const RAIZ_SRC = join(__dirname, '..');

function leerFuentes(): ArchivoFuente[] {
  const salida: ArchivoFuente[] = [];
  const recorrer = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith('.ts')) {
        salida.push({
          ruta: relative(RAIZ_SRC, ruta).split(sep).join('/'),
          contenido: readFileSync(ruta, 'utf8'),
        });
      }
    }
  };
  recorrer(RAIZ_SRC);
  return salida;
}

const f = (ruta: string, contenido: string): ArchivoFuente => ({
  ruta,
  contenido,
});

describe('arquitectura: escritura de tablas de identidad (clase 2)', () => {
  it('solo los módulos de identidad y las excepciones nombradas escriben la clase 2', () => {
    const fuentes = leerFuentes();
    expect(fuentes.length).toBeGreaterThan(10);
    expect(buscarEscriturasIdentidad(fuentes)).toEqual([]);
  });

  it('las excepciones nombradas son exactamente tres archivos de infraestructura', () => {
    expect([...EXCEPCIONES_IDENTIDAD].sort()).toEqual([
      'database/seeds/seed.ts',
      'testing/recorrido-de-pruebas.ts',
      'testing/sesion-de-pruebas.ts',
    ]);
  });

  describe('buscarEscriturasIdentidad (fixtures)', () => {
    it.each([
      ['INSERT INTO', 'q(`INSERT INTO users (email) VALUES ($1)`)', 'users'],
      ['UPDATE', 'q(`update companies SET x = 1`)', 'companies'],
      ['DELETE FROM', 'q(`DELETE\n  FROM sesiones WHERE a = 1`)', 'sesiones'],
      [
        'comillas dobles',
        'q(`UPDATE "invitaciones" SET a = 1`)',
        'invitaciones',
      ],
      [
        'tokens_recuperacion',
        'q(`Insert Into tokens_recuperacion (a) VALUES (1)`)',
        'tokens_recuperacion',
      ],
      [
        'user_company_roles',
        'q(`DELETE FROM user_company_roles`)',
        'user_company_roles',
      ],
    ])(
      'detecta SQL de escritura (%s) fuera de los módulos de identidad',
      (_n, codigo, tabla) => {
        const r = buscarEscriturasIdentidad([f('cargas/x.service.ts', codigo)]);
        expect(r.map((i) => [i.ruta, i.nombre])).toEqual([
          ['cargas/x.service.ts', tabla],
        ]);
      },
    );

    it('detecta escrituras de TypeORM con la entidad como argumento', () => {
      const r = buscarEscriturasIdentidad([
        f(
          'cargas/y.ts',
          [
            'await manager.insert(User, {});',
            'await manager.save(Company, c);',
            'await this.ds.getRepository(Sesion).delete(1);',
            'await manager.update(UserCompanyRole, a, b);',
            'await manager.upsert(Invitacion, a, b);',
            'await manager.softDelete(TokenRecuperacion, 1);',
            'await manager.remove(Company, c);',
          ].join('\n'),
        ),
      ]);
      expect(r.map((i) => [i.nombre, i.linea])).toEqual([
        ['User', 1],
        ['Company', 2],
        ['Sesion', 3],
        ['UserCompanyRole', 4],
        ['Invitacion', 5],
        ['TokenRecuperacion', 6],
        ['Company', 7],
      ]);
    });

    it('detecta escrituras por un repositorio inyectado', () => {
      const r = buscarEscriturasIdentidad([
        f(
          'cargas/z.service.ts',
          [
            'constructor(',
            '  @InjectRepository(Sesion) private readonly repo: Repository<Sesion>,',
            ') {}',
            'async a() { await this.repo.save(x); }',
          ].join('\n'),
        ),
      ]);
      expect(r.map((i) => [i.nombre, i.linea])).toEqual([['Sesion', 4]]);
    });

    it('detecta escrituras por QueryBuilder sobre una entidad', () => {
      const r = buscarEscriturasIdentidad([
        f(
          'cargas/qb.ts',
          [
            'await ds.createQueryBuilder().insert().into(User).values(v).execute();',
            'await ds.createQueryBuilder().delete().from(Sesion).execute();',
            'await ds.createQueryBuilder().update(Company).set({ a: 1 }).execute();',
          ].join('\n'),
        ),
      ]);
      expect(r.map((i) => [i.nombre, i.linea])).toEqual([
        ['User', 1],
        ['Sesion', 2],
        ['Company', 3],
      ]);
    });

    it('permite lecturas: SELECT, JOIN y find sobre un repositorio', () => {
      const r = buscarEscriturasIdentidad([
        f(
          'casos/c.service.ts',
          [
            'q(`SELECT d.id, u.nombre FROM decisiones d JOIN users u ON u.id = d.persona_id`);',
            'q(`SELECT * FROM companies WHERE id = $1 FOR UPDATE`);',
            'await manager.insert(Bitacora, {});',
            '@InjectRepository(User) private readonly users: Repository<User>,',
            'await this.users.findOne({ where: {} });',
          ].join('\n'),
        ),
      ]);
      expect(r).toEqual([]);
    });

    it('ignora comentarios, migraciones y specs', () => {
      const r = buscarEscriturasIdentidad([
        f('cargas/a.ts', '// INSERT INTO users\n/* DELETE FROM sesiones */'),
        f('database/migrations/1-A.ts', 'INSERT INTO users (a) VALUES (1)'),
        f('cargas/a.spec.ts', 'INSERT INTO users (a) VALUES (1)'),
      ]);
      expect(r).toEqual([]);
    });

    it.each([
      'auth',
      'companies',
      'usuarios',
      'invitaciones',
      'recuperacion',
      'plataforma',
    ])('permite escribir al módulo de identidad %s', (modulo) => {
      const r = buscarEscriturasIdentidad([
        f(
          `${modulo}/s.service.ts`,
          'q(`INSERT INTO users (a) VALUES (1)`); manager.save(Sesion, s);',
        ),
      ]);
      expect(r).toEqual([]);
    });

    it('permite las dos excepciones nombradas y ningún otro archivo de esas carpetas', () => {
      const sql = 'q(`INSERT INTO sesiones (a) VALUES (1)`)';
      expect(
        buscarEscriturasIdentidad([
          f('database/seeds/seed.ts', sql),
          f('testing/sesion-de-pruebas.ts', sql),
        ]),
      ).toEqual([]);
      expect(
        buscarEscriturasIdentidad([
          f('testing/otro.ts', sql),
          f('database/seeds/otro.ts', sql),
        ]).map((i) => i.ruta),
      ).toEqual(['testing/otro.ts', 'database/seeds/otro.ts']);
    });
  });
});
