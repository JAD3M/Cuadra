import { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MovimientoLeido } from '../bancos/lector-estado-cuenta';
import { Bitacora } from '../bitacora/bitacora.entity';
import { TransaccionEmpresa } from '../database/transaccion-empresa';

const logger = new Logger('RechazosDePdf');

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

export interface RechazoDePdf {
  companyId: string;
  userId: string;
  archivo: string;
  banco: string;
  /** Código estable del rechazo: el mismo que ve el cliente. */
  motivo: string;
  /** Solo si el lector llegó a leer el PDF. */
  movimientosLeidos?: number;
  lineasNoLeidas?: number;
}

/**
 * Historia 3.3: deja en la bitácora cada PDF rechazado (`rechazar`, sin
 * entidad: no se creó carga). `datos` lleva nombre, banco, motivo y conteos,
 * nunca el contenido del archivo ni el texto de sus líneas.
 *
 * El rechazo es un 400, y la transacción de la petición se revierte con él:
 * una entrada escrita ahí se perdería. Como `AccesosDenegados`, abre una
 * transacción propia con la empresa fijada (la política RLS de `bitacora`
 * acepta el INSERT) y la confirma antes de que la petición responda.
 *
 * Nunca lanza: si la bitácora falla, el usuario recibe su 400 igual y el
 * error queda en el log.
 */
export async function registrarRechazoDePdf(
  transaccion: TransaccionEmpresa,
  rechazo: RechazoDePdf,
): Promise<void> {
  try {
    await transaccion.ejecutar(rechazo.companyId, (manager) =>
      manager.insert(Bitacora, {
        companyId: rechazo.companyId,
        userId: rechazo.userId,
        entidad: 'cargas',
        entidadId: null,
        accion: 'rechazar',
        datos: {
          archivo: [...rechazo.archivo].slice(0, LARGO_NOMBRE).join(''),
          banco: rechazo.banco,
          motivo: rechazo.motivo,
          ...(rechazo.movimientosLeidos === undefined
            ? {}
            : { movimientosLeidos: rechazo.movimientosLeidos }),
          ...(rechazo.lineasNoLeidas === undefined
            ? {}
            : { lineasNoLeidas: rechazo.lineasNoLeidas }),
        },
      }),
    );
  } catch (error) {
    logger.error(
      `No se pudo registrar el rechazo de un PDF de ${rechazo.userId} en ${rechazo.companyId}`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}

/**
 * La zona de espera: los movimientos leídos de un PDF que cuadra, fuera de
 * `movimientos` hasta la vista previa (3.4). Una sola sentencia con arreglos
 * (sin tope de parámetros por fila). El monto va como texto y Postgres lo
 * convierte a NUMERIC: nunca pasa por flotante. `linea_numero` es la posición
 * del movimiento entre los leídos, desde 1.
 */
export async function guardarMovimientosPendientes(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
  banco: string,
  movimientos: readonly MovimientoLeido[],
): Promise<void> {
  if (movimientos.length === 0) return;
  await manager.query(
    `INSERT INTO movimientos_pendientes
       (company_id, carga_id, linea_numero, fecha, descripcion, referencia,
        monto, moneda, banco, cuenta)
     SELECT $1::uuid, $2::uuid, t.linea, t.fecha::date, t.descripcion,
            t.referencia, t.monto::numeric, 'MXN', $3, NULL
       FROM unnest($4::int[], $5::text[], $6::text[], $7::text[], $8::text[])
            AS t(linea, fecha, descripcion, referencia, monto)`,
    [
      companyId,
      cargaId,
      banco,
      movimientos.map((_, i) => i + 1),
      movimientos.map((m) => m.fecha),
      movimientos.map((m) => m.descripcion),
      movimientos.map((m) => m.referencia),
      movimientos.map((m) => m.monto),
    ],
  );
}

/**
 * Historia 3.4: los saldos del PDF se guardan en la carga para la vista
 * previa (el PDF no se guarda). Van como texto y Postgres los convierte a
 * NUMERIC: nunca pasan por flotante.
 */
export async function guardarSaldosDeCarga(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
  saldoInicial: string,
  saldoFinal: string,
): Promise<void> {
  await manager.query(
    `UPDATE cargas
        SET saldo_inicial = $3::numeric, saldo_final = $4::numeric
      WHERE id = $1 AND company_id = $2`,
    [cargaId, companyId, saldoInicial, saldoFinal],
  );
}
