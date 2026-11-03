import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { type ArchivoFuente, buscarEscritoresDeDuenos } from './arquitectura';

/**
 * Historia 1.3: no existe otra vía para crear dueños. En el código de
 * producto (sin specs ni migraciones) solo `plataforma/sembrar-dueno.ts`
 * escribe en `plataforma_usuarios`.
 */

const UNICA_VIA = 'plataforma/sembrar-dueno.ts';
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

describe('historia 1.3: la única vía para crear dueños', () => {
  it('en el código real solo sembrar-dueno.ts escribe en plataforma_usuarios', () => {
    const fuentes = leerFuentes();
    expect(fuentes.some((f) => f.ruta === UNICA_VIA)).toBe(true);
    expect(buscarEscritoresDeDuenos(fuentes)).toEqual([UNICA_VIA]);
  });

  describe('buscarEscritoresDeDuenos (fixtures)', () => {
    it('detecta un INSERT en SQL de otro archivo, aunque cruce líneas', () => {
      const r = buscarEscritoresDeDuenos([
        {
          ruta: 'plataforma/sembrar-dueno.ts',
          contenido:
            "q('INSERT INTO plataforma_usuarios (correo) VALUES ($1)')",
        },
        {
          ruta: 'plataforma/otro.service.ts',
          contenido: 'q(`insert into\n  "plataforma_usuarios" (correo)`)',
        },
      ]);
      expect(r).toEqual([
        'plataforma/otro.service.ts',
        'plataforma/sembrar-dueno.ts',
      ]);
    });

    it('detecta la escritura por repositorio de la entidad', () => {
      const r = buscarEscritoresDeDuenos([
        {
          ruta: 'auth/x.service.ts',
          contenido:
            'constructor(@InjectRepository(PlataformaUsuario) private r: Repository<PlataformaUsuario>) {}\nasync a() { await this.r.save({ correo: "a" }); }',
        },
      ]);
      expect(r).toEqual(['auth/x.service.ts']);
    });

    it('ignora specs, migraciones, comentarios y lecturas', () => {
      const r = buscarEscritoresDeDuenos([
        {
          ruta: 'auth/a.integracion.spec.ts',
          contenido: 'INSERT INTO plataforma_usuarios (correo)',
        },
        {
          ruta: 'database/migrations/1-A.ts',
          contenido: 'INSERT INTO plataforma_usuarios (correo)',
        },
        {
          ruta: 'auth/b.ts',
          contenido:
            '// INSERT INTO plataforma_usuarios\n/* INSERT INTO plataforma_usuarios */',
        },
        {
          ruta: 'plataforma/c.ts',
          contenido:
            'SELECT id FROM plataforma_usuarios; UPDATE plataforma_usuarios SET activo = false; this.usuarios.findOne({});',
        },
      ]);
      expect(r).toEqual([]);
    });
  });
});
