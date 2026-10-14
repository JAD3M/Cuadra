// src/database/seeds/sembrar-dueno.ts
// Entrada de línea de comandos: `npm run sembrar:dueno`. La lógica vive en
// `src/plataforma/sembrar-dueno.ts`; aquí solo se leen las variables.
import dataSource from '../data-source';
import { sembrarDueno } from '../../plataforma/sembrar-dueno';

async function main(): Promise<void> {
  const ds = await dataSource.initialize();
  try {
    await sembrarDueno(ds, {
      correo: process.env.DUENO_CORREO,
      password: process.env.DUENO_PASSWORD,
    });
    console.log('Dueño de Cuadra creado.');
  } finally {
    await ds.destroy();
  }
}

main().catch((error: unknown) => {
  // Solo el mensaje: nunca la contraseña, el hash ni la traza con valores.
  const mensaje = error instanceof Error ? error.message : 'error desconocido';
  console.error(`La siembra del dueño falló: ${mensaje}`);
  process.exit(1);
});
