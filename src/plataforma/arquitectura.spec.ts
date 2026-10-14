import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  type ArchivoFuente,
  buscarInfracciones,
  type ListaBlanca,
} from './arquitectura';

/**
 * AD-2: ningún módulo fuera de `plataforma/` nombra las tablas de clase 3.
 *
 * Exclusiones:
 * - `plataforma/**`: es el dueño de esas tablas.
 * - `database/migrations/**`: las migraciones nombran toda tabla por
 *   naturaleza.
 * - Comentarios: nombrar una tabla en prosa no acopla.
 * Los specs fuera de `plataforma/` SÍ cuentan, salvo la lista blanca.
 */
const LISTA_BLANCA: ListaBlanca = {
  // Registro central de entidades de TypeORM: importa las clases.
  'database/entidades.ts': ['PlataformaUsuario', 'BitacoraPlataforma'],
  // Enumera todas las tablas del esquema para verificar RLS/GRANTs.
  'database/esquema.spec.ts': ['plataforma_usuarios', 'bitacora_plataforma'],
  // Relación por nombre en string, sin importar la clase (sin ciclo).
  'auth/sesion.entity.ts': ['PlataformaUsuario'],
  // Relación por nombre en string, como Sesion: quién invitó (historia 1.5).
  'auth/invitacion.entity.ts': ['PlataformaUsuario'],
  // Relación por nombre en string: de quién es el enlace (historia 1.6).
  'auth/token-recuperacion.entity.ts': ['PlataformaUsuario'],
  // Fixture: inserta al dueño y limpia su rastro para probar invitar y aceptar.
  'invitaciones/invitaciones.integracion.spec.ts': [
    'plataforma_usuarios',
    'bitacora_plataforma',
  ],
  // Fixture que inserta un dueño para probar la sesión de plataforma.
  'auth/auth.integracion.spec.ts': ['plataforma_usuarios'],
};

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

describe('arquitectura: tablas de plataforma (clase 3)', () => {
  it('ningún módulo fuera de plataforma/ nombra tablas ni entidades de clase 3', () => {
    const fuentes = leerFuentes();
    expect(fuentes.length).toBeGreaterThan(10);
    expect(buscarInfracciones(fuentes, LISTA_BLANCA)).toEqual([]);
  });

  it('Sesion.plataformaUsuario es una relación por nombre, sin importar la entidad', () => {
    const sesion = leerFuentes().find(
      (f) => f.ruta === 'auth/sesion.entity.ts',
    );
    expect(sesion).toBeDefined();
    const codigo = sesion?.contenido ?? '';
    expect(codigo).toMatch(/@ManyToOne\('PlataformaUsuario'/);
    expect(codigo).not.toMatch(/from\s+['"][^'"]*plataforma[^'"]*['"]/);
  });

  describe('buscarInfracciones (fixtures)', () => {
    it('detecta una tabla de clase 3 en SQL fuera de plataforma/', () => {
      const r = buscarInfracciones([
        {
          ruta: 'cargas/x.service.ts',
          contenido: 'const a = 1;\nq(`SELECT * FROM plataforma_usuarios`);',
        },
      ]);
      expect(r).toEqual([
        {
          ruta: 'cargas/x.service.ts',
          nombre: 'plataforma_usuarios',
          linea: 2,
        },
      ]);
    });

    it('detecta la clase de entidad y bancos_vista_previa', () => {
      const r = buscarInfracciones([
        {
          ruta: 'bancos/y.ts',
          contenido:
            "import { BitacoraPlataforma } from '../plataforma/b';\n// bancos_vista_previa\nconst t = 'bancos_vista_previa';",
        },
      ]);
      expect(r.map((i) => [i.nombre, i.linea])).toEqual([
        ['BitacoraPlataforma', 1],
        ['bancos_vista_previa', 3],
      ]);
    });

    it('ignora plataforma/, migraciones, comentarios y nombres parecidos', () => {
      const r = buscarInfracciones([
        { ruta: 'plataforma/a.ts', contenido: 'plataforma_usuarios' },
        {
          ruta: 'database/migrations/1-A.ts',
          contenido: 'bitacora_plataforma',
        },
        {
          ruta: 'auth/z.ts',
          contenido:
            '/* plataforma_usuarios */\n// bitacora_plataforma\nconst plataformaUsuarioId = 1; type AccionBitacoraPlataforma = 1;',
        },
      ]);
      expect(r).toEqual([]);
    });

    it('respeta la lista blanca solo para el nombre y archivo indicados', () => {
      const lb: ListaBlanca = { 'a.ts': ['PlataformaUsuario'] };
      const r = buscarInfracciones(
        [
          { ruta: 'a.ts', contenido: 'PlataformaUsuario BitacoraPlataforma' },
          { ruta: 'b.ts', contenido: 'PlataformaUsuario' },
        ],
        lb,
      );
      expect(r.map((i) => `${i.ruta}:${i.nombre}`)).toEqual([
        'a.ts:BitacoraPlataforma',
        'b.ts:PlataformaUsuario',
      ]);
    });
  });
});
