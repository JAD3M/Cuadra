import type { EntityManager } from 'typeorm';
import type { ResultadoDeFila } from '../cargas/carga.entity';
import type { ResultadoDeProceso } from '../cargas/resultado-de-proceso';
import {
  leerFilas,
  leerMovimiento,
  posicionMoneda,
} from './lector-estado-cuenta';
import type { PerfilBancario } from './perfil';

/**
 * CU-09 y CU-10, dentro de la transacción (b) del worker, con el perfil de
 * banco de la carga. Cada fila se valida antes
 * de insertarla: una malformada es un resultado {fila, motivo} y el resto se
 * carga. La idempotencia de movimientos es por posición (company_id,
 * carga_id, linea_numero), no por contenido: dos filas idénticas son dos
 * movimientos.
 *
 * Sin SAVEPOINT por fila: `leerMovimiento` atrapa todo lo que la base
 * rechazaría por culpa de la fila (fecha, monto, largos), así que un error de
 * base aquí siempre es de infraestructura. Con la regla de CU-06 eso aborta
 * el intento completo, y un savepoint nunca se usaría para seguir.
 */
export async function procesarEstadoDeCuenta(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
  {
    banco,
    cuenta,
    perfil,
  }: { banco: string | null; cuenta: string | null; perfil: PerfilBancario },
): Promise<ResultadoDeProceso> {
  const [archivo] = await manager.query<Array<{ contenido: string | null }>>(
    `SELECT contenido FROM carga_archivos
      WHERE carga_id = $1 AND company_id = $2
      ORDER BY orden LIMIT 1`,
    [cargaId, companyId],
  );
  if (archivo?.contenido == null) {
    // El POST ya lo validó: sin archivo es un problema nuestro.
    throw new Error(`Carga ${cargaId}: sin estado de cuenta en carga_archivos`);
  }

  // La primera es el encabezado, ya validado en el POST.
  const [encabezado, ...filas] = leerFilas(archivo.contenido, perfil);
  // Historia 3.1: ya se validó en el POST que toda moneda sea MXN; aquí solo
  // se salta la columna.
  const iMoneda = posicionMoneda(encabezado.campos, perfil);
  const errores: ResultadoDeFila[] = [];
  let nuevos = 0;
  for (const { linea, campos } of filas) {
    const leido = leerMovimiento(campos, perfil, iMoneda);
    if ('motivo' in leido) {
      errores.push({ fila: linea, resultado: 'error', motivo: leido.motivo });
      continue;
    }
    await manager.query(
      `INSERT INTO movimientos
         (company_id, carga_id, linea_numero, fecha, descripcion,
          referencia, monto, banco, cuenta)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7::numeric, $8, $9)`,
      [
        companyId,
        cargaId,
        linea,
        leido.fecha,
        leido.descripcion,
        leido.referencia,
        // Texto directo a NUMERIC: nunca pasa por Number.
        leido.monto,
        banco,
        cuenta,
      ],
    );
    nuevos += 1;
  }
  return {
    resultados: errores,
    nuevos,
    existentes: 0,
    errores: errores.length,
  };
}
