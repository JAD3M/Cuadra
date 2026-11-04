import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { type ArchivoFuente, sinComentarios } from '../plataforma/arquitectura';

/**
 * Historia 4.3 (AD-20 paso 4, AC1): la tabla `conciliaciones` se retira, así
 * que ningún código de producción puede seguir nombrándola.
 *
 * «Nombrar la tabla» es, fuera de comentarios:
 * - SQL que la consulta: `FROM|JOIN|INTO|UPDATE|TABLE|TRUNCATE conciliaciones`
 *   (con o sin comillas y esquema);
 * - `@Entity('conciliaciones')`;
 * - importar la entidad `Conciliacion`.
 *
 * No cuentan: el nombre histórico de entidad en la bitácora (`'conciliaciones'`
 * en `ENTIDADES_BITACORA`), la ruta `/conciliaciones`, el permiso
 * `conciliaciones.resolver` ni los comentarios. Quedan fuera del escaneo las
 * migraciones (nombran toda tabla por naturaleza) y los specs.
 */

type Tipo = 'sql' | 'entity' | 'import';

interface Hallazgo {
  ruta: string;
  linea: number;
  tipo: Tipo;
}

const TABLA = String.raw`(?:"?public"?\.)?["'\`]?conciliaciones\b["'\`]?`;
const PATRONES: ReadonlyArray<readonly [Tipo, RegExp]> = [
  [
    'sql',
    new RegExp(
      String.raw`\b(?:from|join|into|update|table|truncate)\s+(?:only\s+)?${TABLA}`,
      'gi',
    ),
  ],
  // `TRUNCATE a, b, conciliaciones`: la tabla no va pegada a la palabra.
  [
    'sql',
    new RegExp(
      String.raw`\btruncate\s+(?:table\s+)?[^;\`]*?[\s,]${TABLA}`,
      'gi',
    ),
  ],
  ['entity', /@Entity\(\s*['"`]conciliaciones['"`]/g],
  ['import', /\bimport\b[^;]*?\bConciliacion\b[^;]*?\bfrom\b/g],
];

function lineaDe(texto: string, indice: number): number {
  return texto.slice(0, indice).split('\n').length;
}

export function buscarNombresDeConciliaciones(
  archivos: readonly ArchivoFuente[],
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const { ruta, contenido } of archivos) {
    if (ruta.endsWith('.spec.ts')) continue;
    if (ruta.startsWith('database/migrations/')) continue;
    const codigo = sinComentarios(contenido);
    for (const [tipo, patron] of PATRONES) {
      for (const m of codigo.matchAll(patron)) {
        hallazgos.push({ ruta, linea: lineaDe(codigo, m.index ?? 0), tipo });
      }
    }
  }
  return hallazgos;
}

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

describe('arquitectura: la tabla conciliaciones está retirada (4.3, AC1)', () => {
  it('ningún código de producción nombra la tabla ni importa su entidad', () => {
    const fuentes = leerFuentes();
    expect(fuentes.length).toBeGreaterThan(10);
    expect(buscarNombresDeConciliaciones(fuentes)).toEqual([]);
  });

  describe('el escáner', () => {
    const analizar = (contenido: string, ruta = 'x/servicio.ts') =>
      buscarNombresDeConciliaciones([{ ruta, contenido }]);

    it.each([
      ['FROM', 'const q = `SELECT * FROM conciliaciones c`;'],
      ['FROM con comillas', 'const q = `SELECT * FROM "conciliaciones"`;'],
      ['FROM con esquema', 'const q = `SELECT * FROM public.conciliaciones`;'],
      ['JOIN', 'const q = `SELECT 1 FROM a JOIN conciliaciones c ON true`;'],
      ['INTO', 'const q = `INSERT INTO conciliaciones (id) VALUES (1)`;'],
      ['UPDATE', 'const q = `UPDATE conciliaciones SET estado = 1`;'],
      ['TABLE', 'const q = `ALTER TABLE conciliaciones ADD x int`;'],
      ['TRUNCATE', 'const q = `TRUNCATE conciliaciones`;'],
      [
        'TRUNCATE en lista',
        'const q = `TRUNCATE cfdi, conciliaciones CASCADE`;',
      ],
      ['SQL en varias líneas', 'const q = `DELETE FROM\n   conciliaciones`;'],
    ])('detecta SQL: %s', (_nombre, contenido) => {
      expect(analizar(contenido).map((h) => h.tipo)).toContain('sql');
    });

    it("detecta @Entity('conciliaciones')", () => {
      const h = analizar("@Entity('conciliaciones')\nexport class X {}");
      expect(h).toEqual([{ ruta: 'x/servicio.ts', linea: 1, tipo: 'entity' }]);
    });

    it.each([
      "import { Conciliacion } from '../conciliacion/conciliacion.entity';",
      "import {\n  Decision,\n  Conciliacion,\n} from './x';",
    ])('detecta el import de la entidad Conciliacion', (contenido) => {
      expect(analizar(contenido).map((h) => h.tipo)).toEqual(['import']);
    });

    it.each([
      [
        'ruta y permiso',
        "@Controller('conciliaciones')\n@Permiso('conciliaciones.resolver')",
      ],
      ['entidad de bitácora', "const E = ['conciliaciones', 'decisiones'];"],
      [
        'lista SQL de entidades',
        `const L = "('conciliaciones', 'decisiones')";`,
      ],
      ['comentario de línea', '// FROM conciliaciones\nconst a = 1;'],
      ['comentario de bloque', '/* INSERT INTO conciliaciones */ const a = 1;'],
      [
        'tipos con otro nombre',
        "import { type EstadoConciliacion, type OrigenConciliacion } from './t';",
      ],
      ['el servicio y sus funciones', 'tomarCandadoDeConciliacion(manager)'],
      ['URL', 'http().post(`/conciliaciones/${id}/confirmar`)'],
    ])('no cuenta: %s', (_nombre, contenido) => {
      expect(analizar(contenido)).toEqual([]);
    });

    it('ignora los specs y las migraciones', () => {
      const sql = 'const q = `DELETE FROM conciliaciones`;';
      expect(analizar(sql, 'x/y.spec.ts')).toEqual([]);
      expect(analizar(sql, 'database/migrations/1-A.ts')).toEqual([]);
    });
  });
});
