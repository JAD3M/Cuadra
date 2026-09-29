import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { EntityManager } from 'typeorm';
import {
  EstadoDeCuentaRechazado,
  validarEstadoDeCuenta,
} from '../bancos/lector-estado-cuenta';
import {
  PERFIL_POR_DEFECTO,
  PerfilesBancarios,
} from '../bancos/perfiles-bancarios';
import type { TipoCarga } from '../common/entities/tipos';
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

/** Lo que cada tipo de carga le entrega al camino común. */
interface NuevaCarga {
  tipo: TipoCarga;
  /** Idempotencia: mismo hash en la empresa = misma carga. */
  hash: string;
  nombre: string;
  /** CFDI: archivos. Estado de cuenta: filas de datos. */
  total: number;
  archivos: Array<{ nombre: string; hash: string; contenido: string | null }>;
  banco: string | null;
  cuenta: string | null;
  /** Estado de cuenta: el perfil de banco con el que se validó (CU-10). */
  perfil: string | null;
}

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

const INDICE_LOTE = 'ux_cargas_company_id_hash_archivo';

@Injectable()
export class CargasService {
  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly cola: ColaCargas,
    private readonly perfiles: PerfilesBancarios,
  ) {}

  /**
   * CU-06 a CU-08: un lote de CFDI. Cada XML se valida en el worker; un
   * archivo inválido es error de ese archivo, no de la petición.
   */
  async cargarCfdi(
    companyId: string,
    userId: string,
    archivos: readonly ArchivoSubido[],
  ): Promise<RespuestaDeCarga> {
    const hashes = archivos.map((a) => sha256(a.buffer));
    return this.registrar(companyId, userId, {
      tipo: 'cfdi',
      hash: hashDelLote(hashes),
      nombre: nombreDelLote(archivos),
      total: archivos.length,
      archivos: archivos.map((archivo, i) => ({
        nombre: archivo.originalname,
        hash: hashes[i],
        contenido: contenidoComoTexto(archivo.buffer),
      })),
      banco: null,
      cuenta: null,
      perfil: null,
    });
  }

  /**
   * CU-09 y CU-10: un estado de cuenta, leído con el perfil de su banco
   * ('cuadra' si no se dice). El archivo completo se valida aquí, antes de
   * guardar nada (400 si no sirve); las filas, en el worker. Mismo camino que
   * los CFDI desde `registrar`.
   */
  async cargarEstadoCuenta(
    companyId: string,
    userId: string,
    archivo: ArchivoSubido,
    {
      banco,
      cuenta,
      perfil: idPerfil = PERFIL_POR_DEFECTO,
    }: { banco?: string; cuenta?: string; perfil?: string },
  ): Promise<RespuestaDeCarga> {
    const perfil = this.perfiles.obtener(idPerfil);
    if (!perfil) {
      const disponibles = this.perfiles
        .listar()
        .map((p) => p.id)
        .join(', ');
      throw new BadRequestException(
        `Perfil de banco desconocido: "${idPerfil}". Disponibles: ${disponibles}`,
      );
    }
    let validado: { texto: string; filas: number };
    try {
      validado = validarEstadoDeCuenta(archivo.buffer, perfil);
    } catch (error) {
      if (error instanceof EstadoDeCuentaRechazado) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const hash = sha256(archivo.buffer);
    return this.registrar(companyId, userId, {
      tipo: 'estado_cuenta',
      hash,
      nombre: archivo.originalname,
      total: validado.filas,
      archivos: [
        { nombre: archivo.originalname, hash, contenido: validado.texto },
      ],
      banco: banco ?? null,
      cuenta: cuenta ?? null,
      perfil: perfil.id,
    });
  }

  /**
   * El camino común de toda carga (CU-07, CU-08). La idempotencia se
   * resuelve en la petición: mismo hash en la empresa → la carga original,
   * reanudada si no terminó. Si es nueva, los archivos quedan en
   * `carga_archivos`, la carga en 'pendiente', y el job se encola después
   * del COMMIT.
   */
  private async registrar(
    companyId: string,
    userId: string,
    nueva: NuevaCarga,
  ): Promise<RespuestaDeCarga> {
    const manager = this.contexto.manager();
    const carga =
      (await buscarPorHash(manager, companyId, nueva.hash)) ??
      (await crearCarga(manager, companyId, userId, nueva));
    if (carga.yaExistia) return this.reanudar(manager, companyId, carga);

    for (const [orden, archivo] of nueva.archivos.entries()) {
      await manager.query(
        `INSERT INTO carga_archivos
           (company_id, carga_id, orden, nombre, hash, contenido)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          companyId,
          carga.id,
          orden,
          archivo.nombre,
          archivo.hash,
          archivo.contenido,
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
  nueva: NuevaCarga,
): Promise<RespuestaDeCarga> {
  // Savepoint: sin él, el 23505 deja abortada la transacción y ya no se
  // podría consultar a la ganadora.
  await manager.query('SAVEPOINT carga');
  try {
    const [fila] = await manager.query<FilaCarga[]>(
      `INSERT INTO cargas
         (company_id, tipo, estado, nombre_archivo, hash_archivo,
          total_registros, subido_por_id, banco, cuenta, perfil)
       VALUES ($1, $2, 'pendiente', $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SQL_ESTADO}`,
      [
        companyId,
        nueva.tipo,
        nueva.nombre,
        nueva.hash,
        nueva.total,
        userId,
        nueva.banco,
        nueva.cuenta,
        nueva.perfil,
      ],
    );
    await manager.query('RELEASE SAVEPOINT carga');
    return { ...aEstado(fila), yaExistia: false };
  } catch (error) {
    if (!violaIndice(error, INDICE_LOTE)) throw error;
    await manager.query('ROLLBACK TO SAVEPOINT carga');
    // Read committed: la sentencia nueva ya ve la fila que hizo saltar el
    // índice, porque la otra transacción tuvo que confirmar para eso.
    const ganadora = await buscarPorHash(manager, companyId, nueva.hash);
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
