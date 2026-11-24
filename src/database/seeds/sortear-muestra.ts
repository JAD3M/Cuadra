// src/database/seeds/sortear-muestra.ts
// Entrada de línea de comandos: `npm run sortear:muestra -- AAAA-MM [--empresa=RFC]`.
// La lógica vive en `src/sombra/sortear-muestra.ts`; aquí solo se leen los argumentos
// y se imprime lo que pasó con cada empresa.
import dataSource from '../data-source';
import {
  leerArgumentosDeSorteo,
  sortearMuestra,
} from '../../sombra/sortear-muestra';

async function main(): Promise<void> {
  const opciones = leerArgumentosDeSorteo(process.argv.slice(2));
  const ds = await dataSource.initialize();
  try {
    const resultados = await sortearMuestra(ds, opciones);
    for (const r of resultados) {
      console.log(`${r.rfc}  ${r.mes}  ${r.estado}  ${r.casos} casos`);
    }
    if (resultados.length === 0) console.log('No hay empresas activas.');
  } finally {
    await ds.destroy();
  }
}

main().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : 'error desconocido';
  console.error(`El sorteo de la muestra falló: ${mensaje}`);
  process.exit(1);
});
