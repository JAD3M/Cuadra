import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { type EntityManager, QueryFailedError } from 'typeorm';
import { CfdiRechazado } from '../cfdi/cfdi-leido';
import { leerCfdi } from '../cfdi/lector-cfdi';
import type { EstadoCarga } from '../common/entities/tipos';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { ResultadoDeArchivo } from './carga.entity';

/** Lo mínimo de un archivo subido; así el servicio no depende de multer. */
export interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

export interface EstadoDeCarga {
  id: string;
  estado: EstadoCarga;
  totalRegistros: number;
  registrosOk: number;
  registrosExistentes: number;
  registrosError: number;
  resultados: ResultadoDeArchivo[];
}

/** Lo que responde el POST: `yaExistia` si el lote entero ya se había cargado. */
export interface RespuestaDeCarga extends EstadoDeCarga {
  yaExistia: boolean;
}

interface FilaCarga {
  id: string;
  estado: EstadoCarga;
  total_registros: number;
  registros_ok: number;
  registros_existentes: number;
  registros_error: number;
  resultados: ResultadoDeArchivo[];
}

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

const SQL_ESTADO = `id, estado, total_registros, registros_ok,
  registros_existentes, registros_error, resultados`;

const INDICE_LOTE = 'ux_cargas_company_id_hash_archivo';
const INDICE_UUID = 'ux_cfdi_company_id_uuid_fiscal';

@Injectable()
export class CargasService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  /**
   * CU-06 y CU-07, síncrono dentro de la petición (la cola es CU-08).
   * - Lote ya cargado (mismo hash en la empresa): se devuelve la carga
   *   original con `yaExistia`, sin crear nada.
   * - Lote nuevo: una fila en `cargas` y cada archivo en su propio
   *   SAVEPOINT, así que uno que falla no se lleva a los demás.
   */
  async cargarCfdi(
    companyId: string,
    userId: string,
    archivos: readonly ArchivoSubido[],
  ): Promise<RespuestaDeCarga> {
    const manager = this.contexto.manager();
    const hash = hashDelLote(archivos);

    const previa = await buscarPorHash(manager, companyId, hash);
    if (previa) return { ...previa, yaExistia: true };

    const cargaId = await crearCarga(
      manager,
      companyId,
      userId,
      hash,
      archivos,
    );
    if (typeof cargaId !== 'string') return { ...cargaId, yaExistia: true };

    const resultados: ResultadoDeArchivo[] = [];
    for (const archivo of archivos) {
      resultados.push(await guardarCfdi(manager, companyId, cargaId, archivo));
    }

    const cuenta = (r: ResultadoDeArchivo['resultado']) =>
      resultados.filter((x) => x.resultado === r).length;
    const nuevos = cuenta('nuevo');
    const existentes = cuenta('ya_existia');
    const errores = cuenta('error');
    // Un archivo que ya existía no es un fallo: la carga solo es 'fallida'
    // si ninguno quedó en la base, ni nuevo ni de antes.
    const estado: EstadoCarga =
      nuevos + existentes > 0 ? 'procesada' : 'fallida';

    // Con UPDATE, el driver de Postgres devuelve [filas, afectadas].
    const [filas] = await manager.query<[FilaCarga[], number]>(
      `UPDATE cargas
          SET estado = $1, total_registros = $2, registros_ok = $3,
              registros_existentes = $4, registros_error = $5,
              resultados = $6::jsonb, procesada_at = now(),
              updated_at = now()
        WHERE id = $7 AND company_id = $8
        RETURNING ${SQL_ESTADO}`,
      [
        estado,
        archivos.length,
        nuevos,
        existentes,
        errores,
        JSON.stringify(resultados),
        cargaId,
        companyId,
      ],
    );
    return { ...aEstado(filas[0]), yaExistia: false };
  }

  async consultar(companyId: string, cargaId: string): Promise<EstadoDeCarga> {
    // RLS ya filtra por empresa; el WHERE va igual (CLAUDE.md).
    const [fila] = await this.contexto
      .manager()
      .query<FilaCarga[]>(
        `SELECT ${SQL_ESTADO} FROM cargas WHERE id = $1 AND company_id = $2`,
        [cargaId, companyId],
      );
    // Ajena o inexistente, la misma respuesta (CU-04).
    if (!fila) throw new NotFoundException();
    return aEstado(fila);
  }
}

async function buscarPorHash(
  manager: EntityManager,
  companyId: string,
  hash: string,
): Promise<EstadoDeCarga | null> {
  // Mismas columnas que el índice único: lo que el SELECT no encuentre es
  // justo lo que el INSERT deja pasar.
  const [fila] = await manager.query<FilaCarga[]>(
    `SELECT ${SQL_ESTADO} FROM cargas
      WHERE company_id = $1 AND hash_archivo = $2`,
    [companyId, hash],
  );
  return fila ? aEstado(fila) : null;
}

/**
 * Crea la fila de la carga y devuelve su id. Si otra petición con el mismo
 * lote ganó la carrera entre el SELECT previo y este INSERT, salta el índice
 * único: se devuelve la carga ganadora, igual que si el SELECT la hubiera
 * visto.
 */
async function crearCarga(
  manager: EntityManager,
  companyId: string,
  userId: string,
  hash: string,
  archivos: readonly ArchivoSubido[],
): Promise<string | EstadoDeCarga> {
  // Savepoint: sin él, el 23505 deja abortada la transacción y ya no se
  // podría consultar a la ganadora.
  await manager.query('SAVEPOINT carga');
  try {
    // total_registros en 0: ck_cargas_total_cuadra exige que sea la suma
    // de los contadores, y se fija junto con ellos al terminar.
    const [{ id }] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO cargas
         (company_id, tipo, estado, nombre_archivo, hash_archivo, subido_por_id)
       VALUES ($1, 'cfdi', 'procesando', $2, $3, $4)
       RETURNING id`,
      [companyId, nombreDelLote(archivos), hash, userId],
    );
    await manager.query('RELEASE SAVEPOINT carga');
    return id;
  } catch (error) {
    if (!violaIndice(error, INDICE_LOTE)) throw error;
    await manager.query('ROLLBACK TO SAVEPOINT carga');
    // Read committed: la sentencia nueva ya ve la fila que hizo saltar el
    // índice, porque la otra transacción tuvo que confirmar para eso.
    const ganadora = await buscarPorHash(manager, companyId, hash);
    if (!ganadora) throw error;
    return ganadora;
  }
}

/**
 * Un archivo en su propio SAVEPOINT. Solo dos cosas son del archivo: lo que
 * rechaza el lector (error) y el UUID que ya está en la empresa (ya existía).
 * Cualquier otra excepción se relanza y aborta la petición entera: el
 * interceptor hace rollback de todo y Nest responde 500. Reportarla como
 * fallo del archivo escondería un problema nuestro detrás de "el CFDI venía
 * mal".
 */
async function guardarCfdi(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
  archivo: ArchivoSubido,
): Promise<ResultadoDeArchivo> {
  const nombre = archivo.originalname;
  await manager.query('SAVEPOINT archivo');
  try {
    const cfdi = leerCfdi(archivo.buffer.toString('utf8'));
    await manager.query(
      `INSERT INTO cfdi
         (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor,
          serie, folio, fecha_emision, tipo_comprobante, moneda,
          tipo_cambio, subtotal, descuento, total, metodo_pago,
          forma_pago, estado, xml_raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamp, $9, $10,
               $11, $12, $13, $14, $15, $16, $17, $18::jsonb)`,
      [
        companyId,
        cargaId,
        cfdi.uuidFiscal,
        cfdi.rfcEmisor,
        cfdi.rfcReceptor,
        cfdi.serie,
        cfdi.folio,
        // Texto directo a timestamp sin zona: pasar por Date lo movería a
        // la zona del servidor.
        cfdi.fechaEmision,
        cfdi.tipoComprobante,
        cfdi.moneda,
        cfdi.tipoCambio,
        cfdi.subtotal,
        cfdi.descuento,
        cfdi.total,
        cfdi.metodoPago,
        cfdi.formaPago,
        cfdi.estadoInicial,
        JSON.stringify(cfdi.xmlRaw),
      ],
    );
    await manager.query('RELEASE SAVEPOINT archivo');
    return { archivo: nombre, resultado: 'nuevo' };
  } catch (error) {
    if (violaIndice(error, INDICE_UUID)) {
      // Sin esto, el 23505 deja la transacción abortada y todo lo que sigue
      // falla con "current transaction is aborted".
      await manager.query('ROLLBACK TO SAVEPOINT archivo');
      return { archivo: nombre, resultado: 'ya_existia' };
    }
    if (error instanceof CfdiRechazado) {
      await manager.query('ROLLBACK TO SAVEPOINT archivo');
      return { archivo: nombre, resultado: 'error', motivo: error.message };
    }
    throw error;
  }
}

function aEstado(fila: FilaCarga): EstadoDeCarga {
  return {
    id: fila.id,
    estado: fila.estado,
    totalRegistros: fila.total_registros,
    registrosOk: fila.registros_ok,
    registrosExistentes: fila.registros_existentes,
    registrosError: fila.registros_error,
    resultados: fila.resultados,
  };
}

function sha256(datos: Buffer | string): string {
  return createHash('sha256').update(datos).digest('hex');
}

/** SHA-256 de los SHA-256 de cada archivo, ordenados: el orden no importa. */
export function hashDelLote(archivos: readonly ArchivoSubido[]): string {
  return sha256(
    archivos
      .map((a) => sha256(a.buffer))
      .sort()
      .join('\n'),
  );
}

function nombreDelLote(archivos: readonly ArchivoSubido[]): string {
  const nombre =
    archivos.length === 1
      ? archivos[0].originalname
      : `${archivos.length} archivos: ${archivos.map((a) => a.originalname).join(', ')}`;
  return nombre.length > LARGO_NOMBRE
    ? `${nombre.slice(0, LARGO_NOMBRE - 1)}…`
    : nombre;
}

function violaIndice(error: unknown, indice: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint } = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return code === '23505' && constraint === indice;
}
