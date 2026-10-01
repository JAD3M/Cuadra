// Verifica la salida de `vite build`: no debe contener referencias a hosts
// externos de fuentes ni restos de la galería de desarrollo (`/__kit`).
//
// Uso: node scripts/verificar-dist.mjs [carpeta]   (por defecto `dist`)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Cadenas que no pueden aparecer en la salida de producción. */
export const PROHIBIDAS = [
  {
    texto: 'fonts.googleapis',
    motivo: 'referencia a Google Fonts (las fuentes van autoalojadas)',
  },
  {
    texto: 'gstatic',
    motivo: 'referencia a gstatic (las fuentes van autoalojadas)',
  },
  { texto: '__kit', motivo: 'ruta de la galería, solo para desarrollo' },
  {
    texto: 'Galería de componentes',
    motivo: 'texto de la galería, solo para desarrollo',
  },
  {
    texto: 'Piezas del shell',
    motivo: 'texto de la galería, solo para desarrollo',
  },
];

// Solo se leen archivos de texto; las fuentes y otros binarios no se inspeccionan.
const EXTENSIONES_DE_TEXTO = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
]);

function* archivosDe(carpeta) {
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) yield* archivosDe(ruta);
    else if (EXTENSIONES_DE_TEXTO.has(path.extname(entrada.name))) yield ruta;
  }
}

/**
 * Devuelve la lista de problemas encontrados en `carpeta` (vacía si está
 * limpia). Lanza si la carpeta no existe: sin build no hay nada que verificar.
 */
export function verificarDist(carpeta) {
  if (!fs.existsSync(carpeta)) {
    throw new Error(`No existe ${carpeta}; ejecuta primero "npm run build".`);
  }
  const problemas = [];
  for (const archivo of archivosDe(carpeta)) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    for (const { texto, motivo } of PROHIBIDAS) {
      if (contenido.includes(texto)) {
        problemas.push(
          `${path.relative(carpeta, archivo)}: contiene "${texto}" (${motivo})`,
        );
      }
    }
  }
  return problemas;
}

function main() {
  const carpeta = path.resolve(process.argv[2] ?? 'dist');
  let problemas;
  try {
    problemas = verificarDist(carpeta);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (problemas.length > 0) {
    console.error('La salida de producción no es válida:');
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  console.log(`verificar-dist: ${carpeta} limpio.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
