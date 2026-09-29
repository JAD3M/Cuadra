import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { EntityManager } from 'typeorm';
import { ContextoEmpresa } from '../database/contexto-empresa';
import { ColaCargas } from './cola-cargas';
import {
  aEstado,
  type EstadoDeCarga,
  type FilaCarga,
  SQL_ESTADO,
} from './estado-de-carga';
import { violaIndice } from './guardar-cfdi';

export type { EstadoDeCarga } from './estado-de-carga';

/** Lo mínimo de un archivo subido; así el servicio no depende de multer. */
export interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

/** Lo que responde el POST: `yaExistia` si el lote entero ya se había cargado. */
export interface RespuestaDeCarga extends EstadoDeCarga {
  yaExistia: boolean;
}

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

const INDICE_LOTE = 'ux_cargas_company_id_hash_archivo';

@Injectable()
export class CargasService {
  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly cola: ColaCargas,
  ) {}

  /**
   * CU-06, CU-07 y CU-08. La idempotencia del lote se resuelve aquí, en la
   * petición. El procesamiento no: los archivos quedan en `carga_archivos`,
   * la carga en 'pendiente', y el job se encola después del COMMIT.
   */
  async cargarCfdi(
    companyId: string,
    userId: string,
    archivos: readonly ArchivoSubido[],
  ): Promise<RespuestaDeCarga> {
    const manager = this.contexto.manager();
    const hashes = archivos.map((a) => sha256(a.buffer));
    const hash = hashDelLote(hashes);

    const carga =
      (await buscarPorHash(manager, companyId, hash)) ??
      (await crearCarga(manager, companyId, userId, hash, archivos));
    if (carga.yaExistia) return this.reanudar(manager, companyId, carga);

    for (const [orden, archivo] of archivos.entries()) {
      await manager.query(
        `INSERT INTO carga_archivos
           (company_id, carga_id, orden, nombre, hash, contenido)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          companyId,
          carga.id,
          orden,
          archivo.originalname,
          hashes[orden],
          contenidoComoTexto(archivo.buffer),
        ],
      );
    }
    this.encolarAlConfirmar(carga.id, companyId);
    return carga;
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

  /**
   * Resubir un lote que no terminó lo reencola. Es la salida cuando Redis
   * perdió el job, el encolado falló después del commit, el worker murió a
   * media carga o se agotaron los reintentos. Terminada ('procesada',
   * 'con_errores'), se devuelve tal cual. La respuesta dice `yaExistia`
   * siempre, con el estado actual.
   */
  private async reanudar(
    manager: EntityManager,
    companyId: string,
    carga: RespuestaDeCarga,
  ): Promise<RespuestaDeCarga> {
    if (carga.estado === 'procesada' || carga.estado === 'con_errores') {
      return carga;
    }
    let actual = carga;
    if (carga.estado === 'fallida') {
      // Otra vez desde cero: los XML siguen en carga_archivos, y el intento
      // fallido no dejó CFDI (se revierte completo).
      const [filas] = await manager.query<[FilaCarga[], number]>(
        `UPDATE cargas
            SET estado = 'pendiente', registros_ok = 0,
                registros_existentes = 0, registros_error = 0,
                resultados = '[]', error_mensaje = NULL,
                procesada_at = NULL, updated_at = now()
          WHERE id = $1 AND company_id = $2 AND estado = 'fallida'
          RETURNING ${SQL_ESTADO}`,
        [carga.id, companyId],
      );
      // Sin fila: otra petición la reinició primero. Su estado actual.
      actual =
        filas[0] !== undefined
          ? { ...aEstado(filas[0]), yaExistia: true }
          : ((await buscarPorId(manager, companyId, carga.id)) ?? carga);
    }
    // 'pendiente' o 'procesando': jobId = cargaId, así que si el job sigue
    // en la cola esto no crea otro.
    this.encolarAlConfirmar(actual.id, companyId);
    return actual;
  }

  /** Antes del COMMIT, el worker podría tomar el job y no ver la carga. */
  private encolarAlConfirmar(cargaId: string, companyId: string): void {
    this.contexto.alConfirmar(() => this.cola.encolar({ cargaId, companyId }));
  }
}

async function buscarPorId(
  manager: EntityManager,
  companyId: string,
  id: string,
): Promise<RespuestaDeCarga | null> {
  const [fila] = await manager.query<FilaCarga[]>(
    `SELECT ${SQL_ESTADO} FROM cargas WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  return fila ? { ...aEstado(fila), yaExistia: true } : null;
}

async function buscarPorHash(
  manager: EntityManager,
  companyId: string,
  hash: string,
): Promise<RespuestaDeCarga | null> {
  // Mismas columnas que el índice único: lo que el SELECT no encuentre es
  // justo lo que el INSERT deja pasar.
  const [fila] = await manager.query<FilaCarga[]>(
    `SELECT ${SQL_ESTADO} FROM cargas
      WHERE company_id = $1 AND hash_archivo = $2`,
    [companyId, hash],
  );
  return fila ? { ...aEstado(fila), yaExistia: true } : null;
}

/**
 * Crea la carga en 'pendiente' con el total ya fijado. Si otra petición con
 * el mismo lote ganó la carrera entre el SELECT previo y este INSERT, salta
 * el índice único: se devuelve la ganadora, igual que si el SELECT la hubiera
 * visto.
 */
async function crearCarga(
  manager: EntityManager,
  companyId: string,
  userId: string,
  hash: string,
  archivos: readonly ArchivoSubido[],
): Promise<RespuestaDeCarga> {
  // Savepoint: sin él, el 23505 deja abortada la transacción y ya no se
  // podría consultar a la ganadora.
  await manager.query('SAVEPOINT carga');
  try {
    const [fila] = await manager.query<FilaCarga[]>(
      `INSERT INTO cargas
         (company_id, tipo, estado, nombre_archivo, hash_archivo,
          total_registros, subido_por_id)
       VALUES ($1, 'cfdi', 'pendiente', $2, $3, $4, $5)
       RETURNING ${SQL_ESTADO}`,
      [companyId, nombreDelLote(archivos), hash, archivos.length, userId],
    );
    await manager.query('RELEASE SAVEPOINT carga');
    return { ...aEstado(fila), yaExistia: false };
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
 * `text` de Postgres no admite el byte 0. Un XML con NUL no es XML válido:
 * se guarda NULL y el worker lo reporta como error del archivo, sin tumbar
 * al resto del lote.
 */
function contenidoComoTexto(buffer: Buffer): string | null {
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

function sha256(datos: Buffer | string): string {
  return createHash('sha256').update(datos).digest('hex');
}

/** SHA-256 de los SHA-256 de cada archivo, ordenados: el orden no importa. */
export function hashDelLote(hashes: readonly string[]): string {
  return sha256([...hashes].sort().join('\n'));
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
