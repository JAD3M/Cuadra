import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  construirEscenarios,
  type CfdiDemo,
  type MovimientoDemo,
} from './escenarios';
import { escribirCfdi, escribirCsv } from './formatos';

/**
 * CU-18. Genera los archivos de la demo: `demo/cfdi/*.xml` y los estados de
 * cuenta. Pura y determinista (misma tabla, mismos bytes): `generarDemo()`
 * devuelve ruta relativa → contenido, y el CLI solo la escribe en `demo/`.
 * `demo-drift.spec.ts` vigila que lo commiteado sea exactamente esta salida.
 */

export function nombreDeCfdi(c: CfdiDemo): string {
  return `demo/cfdi/${c.empresa}-${c.serie}-${c.folio}.xml`;
}

const CSV_POR_ARCHIVO: Record<string, string> = {
  '1': 'demo/estado-cuenta-1.csv',
  '2': 'demo/estado-cuenta-2.csv',
  tcu: 'demo/estado-cuenta-tcu.csv',
};

export function generarDemo(): Map<string, string> {
  const escenarios = construirEscenarios();
  const salida = new Map<string, string>();

  for (const e of escenarios) {
    for (const c of e.cfdis) salida.set(nombreDeCfdi(c), escribirCfdi(c));
  }

  // Por fecha y, a igual fecha, en el orden de la tabla (el sort es estable).
  const movimientos: MovimientoDemo[] = escenarios.flatMap(
    (e) => e.movimientos,
  );
  for (const [archivo, ruta] of Object.entries(CSV_POR_ARCHIVO)) {
    const filas = movimientos
      .filter((m) => String(m.archivo) === archivo)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    salida.set(ruta, escribirCsv(filas));
  }
  return salida;
}

/** Escribe `generarDemo()` en `raiz` y borra los XML que ya no se generan. */
export function escribirDemo(raiz: string): number {
  const archivos = generarDemo();
  const carpetaCfdi = join(raiz, 'demo', 'cfdi');
  mkdirSync(carpetaCfdi, { recursive: true });
  const vigentes = new Set(
    [...archivos.keys()].map((ruta) => join(raiz, ruta)),
  );
  for (const nombre of readdirSync(carpetaCfdi)) {
    const ruta = join(carpetaCfdi, nombre);
    if (nombre.endsWith('.xml') && !vigentes.has(ruta)) rmSync(ruta);
  }
  for (const [ruta, contenido] of archivos) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido, 'utf8');
  }
  return archivos.size;
}

if (require.main === module) {
  const total = escribirDemo(join(__dirname, '..', '..'));
  console.log(`demo/: ${total} archivos generados`);
}
