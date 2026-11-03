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
        !a.ruta.startsWith('database/migrations/'),
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
