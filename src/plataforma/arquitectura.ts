/**
 * AD-2. Regla de arquitectura: las tablas de clase 3 (plataforma) solo las
 * nombra el módulo `plataforma/`. Este helper es puro para poder probarlo
 * con fixtures en memoria sin ensuciar el repositorio.
 */

export const NOMBRES_CLASE_3 = [
  // Tablas (snake_case).
  'plataforma_usuarios',
  'bitacora_plataforma',
  // Aún no existe; la regla queda puesta antes que la tabla.
  'bancos_vista_previa',
  // Única función SECURITY DEFINER (salida de RLS): solo `plataforma/` la llama.
  'cargas_aceptadas_por_banco',
  // Clases de entidad (y su nombre en `@Entity`/relaciones por string).
  'PlataformaUsuario',
  'BitacoraPlataforma',
] as const;

export interface ArchivoFuente {
  /** Ruta relativa a `src/`, con `/` como separador. */
  ruta: string;
  contenido: string;
}

export interface Infraccion {
  ruta: string;
  nombre: string;
  linea: number;
}

/** Nombres que un archivo concreto puede nombrar fuera de `plataforma/`. */
export type ListaBlanca = Readonly<Record<string, readonly string[]>>;

/** Quita comentarios: nombrar una tabla en prosa no acopla a nada. */
export function sinComentarios(codigo: string): string {
  // Conserva los saltos de línea para no desplazar los números de línea.
  const sinBloques = codigo.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' '),
  );
  return sinBloques.replace(/(^|\s)\/\/.*$/gm, '$1');
}

function esDePlataforma(ruta: string): boolean {
  return ruta.startsWith('plataforma/');
}

export function buscarInfracciones(
  archivos: readonly ArchivoFuente[],
  listaBlanca: ListaBlanca = {},
): Infraccion[] {
  const infracciones: Infraccion[] = [];
  for (const archivo of archivos) {
    if (esDePlataforma(archivo.ruta)) continue;
    if (archivo.ruta.startsWith('database/migrations/')) continue;
    const permitidos = listaBlanca[archivo.ruta] ?? [];
    const lineas = sinComentarios(archivo.contenido).split('\n');
    lineas.forEach((texto, i) => {
      for (const nombre of NOMBRES_CLASE_3) {
        if (permitidos.includes(nombre)) continue;
        // `\b` no cruza `_` ni letras: `plataformaUsuarioId` y
        // `AccionBitacoraPlataforma` no cuentan como el nombre.
        if (new RegExp(`\\b${nombre}\\b`).test(texto)) {
          infracciones.push({ ruta: archivo.ruta, nombre, linea: i + 1 });
        }
      }
    });
  }
  return infracciones;
}

const INSERT_EN_DUENOS = /\binsert\s+into\s+"?plataforma_usuarios\b/i;
const ESCRITURA_POR_REPOSITORIO = /\.(save|insert|upsert)\s*\(/;

/**
 * Infraestructura de pruebas que inserta un dueño a propósito: los recorridos
 * de punta a punta no tienen ruta para sembrarlo (7.2 a 7.4).
 */
export const EXCEPCIONES_DUENOS = ['testing/recorrido-de-pruebas.ts'] as const;

/**
 * Historia 1.3. Rutas (relativas a `src/`) del código de producto que escribe
 * un dueño en `plataforma_usuarios`: SQL `INSERT INTO` o escritura por
 * repositorio de la entidad. Excluye specs y migraciones, y no cuenta
 * comentarios ni lecturas. Debe devolver solo `sembrar-dueno.ts`.
 */
export function buscarEscritoresDeDuenos(
  archivos: readonly ArchivoFuente[],
): string[] {
  return archivos
    .filter(
      (a) =>
        !a.ruta.endsWith('.spec.ts') &&
        !a.ruta.startsWith('database/migrations/') &&
        !(EXCEPCIONES_DUENOS as readonly string[]).includes(a.ruta),
    )
    .filter((a) => {
      const codigo = sinComentarios(a.contenido);
      return (
        INSERT_EN_DUENOS.test(codigo) ||
        (/\bPlataformaUsuario\b/.test(codigo) &&
          ESCRITURA_POR_REPOSITORIO.test(codigo))
      );
    })
    .map((a) => a.ruta)
    .sort();
}

/**
 * AD-2, clase 2 (identidad). Quién puede ESCRIBIR (INSERT/UPDATE/DELETE) las
 * tablas de identidad. Leerlas (SELECT, JOIN) lo puede hacer cualquier módulo.
 */
export const TABLAS_CLASE_2 = [
  'companies',
  'users',
  'user_company_roles',
  'sesiones',
  'invitaciones',
  'tokens_recuperacion',
] as const;

/** Entidades de TypeORM de esas tablas. */
export const ENTIDADES_CLASE_2 = [
  'Company',
  'User',
  'UserCompanyRole',
  'Sesion',
  'Invitacion',
  'TokenRecuperacion',
] as const;

/** Módulos (primer segmento bajo `src/`) que pueden escribir la clase 2. */
export const MODULOS_IDENTIDAD = [
  'auth',
  'companies',
  'usuarios',
  'invitaciones',
  'recuperacion',
  'plataforma',
] as const;

/** Infraestructura que no es producto y escribe identidad a propósito. */
export const EXCEPCIONES_IDENTIDAD = [
  // Siembra empresas, usuarios y roles de desarrollo.
  'database/seeds/seed.ts',
  // Abre una sesión directa para las pruebas de integración.
  'testing/sesion-de-pruebas.ts',
  // Arranque y limpieza de los recorridos de punta a punta (7.2 a 7.4).
  'testing/recorrido-de-pruebas.ts',
] as const;

const METODOS_ESCRITURA = 'save|insert|update|delete|remove|softDelete|upsert';

function lineaDe(texto: string, indice: number): number {
  return texto.slice(0, indice).split('\n').length;
}

export function buscarEscriturasIdentidad(
  archivos: readonly ArchivoFuente[],
): Infraccion[] {
  const infracciones: Infraccion[] = [];
  const entidades = ENTIDADES_CLASE_2.join('|');
  const tablas = TABLAS_CLASE_2.join('|');
  for (const archivo of archivos) {
    const { ruta } = archivo;
    if (ruta.endsWith('.spec.ts')) continue;
    if (ruta.startsWith('database/migrations/')) continue;
    if ((MODULOS_IDENTIDAD as readonly string[]).includes(ruta.split('/')[0]))
      continue;
    if ((EXCEPCIONES_IDENTIDAD as readonly string[]).includes(ruta)) continue;
    const codigo = sinComentarios(archivo.contenido);
    const hallazgos: { nombre: string; indice: number }[] = [];
    const buscar = (re: RegExp, grupo = 1): void => {
      for (const m of codigo.matchAll(re)) {
        hallazgos.push({ nombre: m[grupo], indice: m.index ?? 0 });
      }
    };
    // SQL: INSERT INTO / UPDATE / DELETE FROM sobre una tabla de identidad.
    buscar(
      new RegExp(
        `\\b(?:insert\\s+into|update|delete\\s+from)\\s+"?(${tablas})"?(?![\\w])`,
        'gi',
      ),
    );
    // TypeORM: `manager.save(User, ...)`, `getRepository(User).delete(...)`.
    buscar(
      new RegExp(`\\.(?:${METODOS_ESCRITURA})\\(\\s*(${entidades})\\b`, 'g'),
    );
    buscar(
      new RegExp(
        `getRepository\\(\\s*(${entidades})\\s*\\)\\s*\\.(?:${METODOS_ESCRITURA})\\(`,
        'g',
      ),
    );
    // QueryBuilder: `.into(User)`, `.delete().from(User)`.
    buscar(new RegExp(`\\.into\\(\\s*(${entidades})\\s*\\)`, 'g'));
    buscar(
      new RegExp(`\\.delete\\(\\)\\s*\\.from\\(\\s*(${entidades})\\s*\\)`, 'g'),
    );
    // Repositorio inyectado: `@InjectRepository(Sesion) private repo` y luego
    // `this.repo.save(...)`.
    for (const m of codigo.matchAll(
      new RegExp(
        `InjectRepository\\(\\s*(${entidades})\\s*\\)\\s*(?:(?:private|public|protected)\\s+)?(?:readonly\\s+)?(\\w+)`,
        'g',
      ),
    )) {
      const uso = new RegExp(
        `this\\.${m[2]}\\.(?:${METODOS_ESCRITURA})\\(`,
        'g',
      );
      for (const u of codigo.matchAll(uso)) {
        hallazgos.push({ nombre: m[1], indice: u.index ?? 0 });
      }
    }
    hallazgos
      .sort((a, b) => a.indice - b.indice)
      .forEach((h) =>
        infracciones.push({
          ruta,
          nombre: h.nombre,
          linea: lineaDe(codigo, h.indice),
        }),
      );
  }
  return infracciones;
}
