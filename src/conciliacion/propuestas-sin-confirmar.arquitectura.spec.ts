import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { type ArchivoFuente, sinComentarios } from '../plataforma/arquitectura';

/**
 * Historia 4.4 (AD-3, AC5): el motor de reglas y la IA solo crean propuestas;
 * nunca una decisión `confirmada`. Confirmar es de una persona.
 *
 * La base ya lo exige: `ck_decisiones_confirmada_requiere_persona` pide
 * `confirmada_por_id` y `confirmada_at`. Esta prueba lo cierra también en el
 * código: en los módulos del motor (`conciliacion/`) y de la IA
 * (`sugerencias/`), fuera de comentarios, no puede haber
 * - ninguna mención de las columnas de la persona que confirma;
 * - ninguna escritura del estado `confirmada`: `SET estado = 'confirmada'`,
 *   `estado: 'confirmada'` o un `INSERT` que lleve ese literal.
 *
 * Leer decisiones confirmadas es legítimo (`estado IN ('propuesta',
 * 'confirmada')` para saber qué está ocupado) y no cuenta.
 *
 * Fuera del escaneo, por su naturaleza: los specs, la entidad `Decision`
 * (declara el CHECK) y la siembra de pruebas, que escribe decisiones de
 * ejemplo a propósito.
 */

type Tipo = 'persona' | 'set' | 'literal' | 'insert';

interface Hallazgo {
  ruta: string;
  linea: number;
  tipo: Tipo;
}

const MODULOS_PRODUCTORES = ['conciliacion/', 'sugerencias/'] as const;

const EXENTOS = [
  'conciliacion/decision.entity.ts',
  'conciliacion/siembra-decisiones.ts',
] as const;

// Un fragmento de SQL termina en `;`, en la comilla de cierre de la plantilla
// o en WHERE: lo que sigue a un WHERE es lectura, no escritura.
const SIN_WHERE = String.raw`(?:(?!\bwhere\b)[^;\`])*?`;
const SIN_FIN_DE_INSERT = String.raw`(?:(?!\b(?:where|returning|on\s+conflict)\b)[^;\`])*?`;

const PATRONES: ReadonlyArray<readonly [Tipo, RegExp]> = [
  ['persona', /\bconfirmada_(?:por_id|at)\b|\bconfirmada(?:Por|At)(?:Id)?\b/g],
  [
    'set',
    new RegExp(
      String.raw`\bset\b${SIN_WHERE}\bestado\s*=\s*['"]confirmada['"]`,
      'gi',
    ),
  ],
  ['literal', /\bestado\s*:\s*['"`]confirmada['"`]/g],
  [
    'insert',
    new RegExp(
      String.raw`\binsert\s+into\b${SIN_FIN_DE_INSERT}['"]confirmada['"]`,
      'gi',
    ),
  ],
];

function lineaDe(texto: string, indice: number): number {
  return texto.slice(0, indice).split('\n').length;
}

export function buscarConfirmaciones(
  archivos: readonly ArchivoFuente[],
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const { ruta, contenido } of archivos) {
    if (ruta.endsWith('.spec.ts')) continue;
    if ((EXENTOS as readonly string[]).includes(ruta)) continue;
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

function leerFuentes(prefijos: readonly string[]): ArchivoFuente[] {
  const salida: ArchivoFuente[] = [];
  const recorrer = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith('.ts')) {
        const rel = relative(RAIZ_SRC, ruta).split(sep).join('/');
        if (prefijos.some((p) => rel.startsWith(p))) {
          salida.push({ ruta: rel, contenido: readFileSync(ruta, 'utf8') });
        }
      }
    }
  };
  recorrer(RAIZ_SRC);
  return salida;
}

describe('arquitectura: el motor y la IA solo crean propuestas (4.4, AC5, AD-3)', () => {
  it('ningún módulo del motor ni de la IA escribe una decisión confirmada', () => {
    const fuentes = leerFuentes(MODULOS_PRODUCTORES);
    expect(fuentes.length).toBeGreaterThan(10);
    expect(fuentes.some((f) => f.ruta.startsWith('sugerencias/'))).toBe(true);
    expect(fuentes.some((f) => f.ruta === 'conciliacion/evaluar-par.ts')).toBe(
      true,
    );
    expect(buscarConfirmaciones(fuentes)).toEqual([]);
  });

  it('el escáner no es ciego: el módulo donde la persona confirma sí se detecta', () => {
    const resolucion = leerFuentes(['resolucion/']);
    expect(resolucion.length).toBeGreaterThan(0);
    expect(buscarConfirmaciones(resolucion).length).toBeGreaterThan(0);
  });

  describe('el escáner', () => {
    const analizar = (contenido: string, ruta = 'conciliacion/x.ts') =>
      buscarConfirmaciones([{ ruta, contenido }]).map((h) => h.tipo);

    it.each([
      [
        'SET del estado',
        "const q = `UPDATE decisiones SET estado = 'confirmada' WHERE id = $1`;",
        'set',
      ],
      [
        'SET con otra columna antes',
        "const q = `UPDATE decisiones SET motivo = $2, estado = 'confirmada'`;",
        'set',
      ],
      ['literal en objeto', "const d = { estado: 'confirmada' };", 'literal'],
      [
        'INSERT con el literal',
        "const q = `INSERT INTO decisiones (estado) VALUES ('confirmada')`;",
        'insert',
      ],
      [
        'INSERT ... SELECT con el literal',
        "const q = `INSERT INTO decisiones (estado) SELECT 'confirmada' FROM t`;",
        'insert',
      ],
      ['columna de la persona', 'const c = "confirmada_por_id";', 'persona'],
      ['fecha de confirmación', 'x.confirmada_at = new Date();', 'persona'],
      ['propiedad de la entidad', 'x.confirmadaPorId = u.id;', 'persona'],
    ])('detecta: %s', (_nombre, contenido, tipo) => {
      expect(analizar(contenido)).toContain(tipo);
    });

    it.each([
      [
        'leer los ocupados',
        "const q = `SELECT 1 FROM decisiones d WHERE d.estado IN ('propuesta', 'confirmada')`;",
      ],
      [
        'INSERT ... SELECT que solo lee confirmadas',
        "const q = `INSERT INTO decisiones (estado) SELECT 'propuesta' FROM t WHERE NOT EXISTS (SELECT 1 FROM decisiones d WHERE d.estado IN ('propuesta', 'confirmada'))`;",
      ],
      [
        'UPDATE que solo filtra por confirmada',
        "const q = `UPDATE decisiones SET estado = 'obsoleta' WHERE estado = 'confirmada'`;",
      ],
      [
        'comentario',
        "// SET estado = 'confirmada' lo hace la persona (confirmada_por_id)\nconst x = 1;",
      ],
      [
        'comentario de bloque',
        "/* estado: 'confirmada' y confirmada_at */\nconst x = 1;",
      ],
    ])('no marca: %s', (_nombre, contenido) => {
      expect(analizar(contenido)).toEqual([]);
    });

    it('omite los specs y las rutas exentas', () => {
      const codigo = "const d = { estado: 'confirmada' };";
      expect(analizar(codigo, 'conciliacion/x.spec.ts')).toEqual([]);
      expect(analizar(codigo, 'conciliacion/siembra-decisiones.ts')).toEqual(
        [],
      );
      expect(analizar(codigo, 'conciliacion/decision.entity.ts')).toEqual([]);
    });

    it('reporta ruta y línea', () => {
      const h = buscarConfirmaciones([
        {
          ruta: 'sugerencias/x.ts',
          contenido: "const a = 1;\nconst d = { estado: 'confirmada' };",
        },
      ]);
      expect(h).toEqual([
        { ruta: 'sugerencias/x.ts', linea: 2, tipo: 'literal' },
      ]);
    });
  });
});
