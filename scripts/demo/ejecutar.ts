import { ejecutarDemo, ErrorDemo } from './runner';

/**
 * CU-18. CLI de `npm run demo`. Códigos de salida: 0 si la demo corrió (o ya
 * estaba cargada), 1 si algún paso no dio lo esperado.
 */

async function main(): Promise<void> {
  const baseUrl = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
  console.log(`Cuadra demo contra ${baseUrl}\n`);
  try {
    const resultado = await ejecutarDemo({
      baseUrl,
      log: (linea) => console.log(linea),
    });
    if (resultado === 'ya-cargado') {
      console.log(
        '\nNada que hacer: la demo ya estaba cargada. Para repetirla desde cero:\n' +
          '  docker compose down -v && docker compose up -d --build\n' +
          '  (y otra vez migration:run, seed y demo; ver README)',
      );
    }
  } catch (error) {
    if (error instanceof ErrorDemo) {
      console.error(`\nFALLÓ ${error.message}`);
      const { esperado, actual, pista } = error.detalle;
      if (esperado !== undefined)
        console.error(`  esperado: ${`${esperado as string}`}`);
      if (actual !== undefined)
        console.error(`  actual:   ${`${actual as string}`}`);
      if (pista) console.error(`  pista:    ${pista}`);
    } else {
      console.error('\nFALLÓ con un error inesperado:', error);
    }
    process.exit(1);
  }
}

void main();
