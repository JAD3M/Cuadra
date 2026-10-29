import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { EntityManager } from 'typeorm';
import { cuadrarSaldos } from '../bancos/cuadre-saldos';
import {
  CODIGO_LINEAS_NO_LEIDAS,
  CODIGO_SIN_MOVIMIENTOS,
  CODIGO_SALDOS_NO_CUADRAN,
  EstadoDeCuentaRechazado,
  MENSAJE_LINEAS_NO_LEIDAS,
  MENSAJE_SIN_MOVIMIENTOS,
  MENSAJE_SALDOS_NO_CUADRAN,
  validarEstadoDeCuenta,
} from '../bancos/lector-estado-cuenta';
import {
  PERFIL_POR_DEFECTO,
  PerfilesBancarios,
} from '../bancos/perfiles-bancarios';
import type { EstadoCarga, TipoCarga } from '../common/entities/tipos';
import { ContextoEmpresa } from '../database/contexto-empresa';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { ColaCargas } from './cola-cargas';
import {
  guardarMovimientosPendientes,
  registrarRechazoDePdf,
} from './guardar-estado-cuenta-pdf';
import { registrarCargar } from './registrar-carga';
import type { LineaNoLeida } from '../bancos/pdf/lector-bbva';
import {
  aEstado,
  type EstadoDeCarga,
  type FilaCarga,
  SQL_ESTADO,
} from './estado-de-carga';
import { violaIndice } from './guardar-cfdi';
import { BANCOS_PDF, lectorPdfDe } from '../bancos/pdf/lectores-pdf';
import { extraerTextoPdf } from '../bancos/pdf/extraer-texto-pdf';
import type { CargaListadaDto } from './dto/lista-cargas.dto';
import type { RespuestaLecturaPdfDto } from './dto/lectura-pdf.dto';

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
  /** 'pendiente' si no se dice: el worker toma la carga. */
  estado?: EstadoCarga;
}

/** El rechazo del archivo, a 400; con código estable si lo trae. */
function comoBadRequest(error: unknown): unknown {
  if (!(error instanceof EstadoDeCuentaRechazado)) return error;
  return new BadRequestException(
    error.codigo === undefined
      ? error.message
      : { statusCode: 400, message: error.message, error: error.codigo },
  );
}

/**
 * Historia 3.3: el rechazo de un PDF que se leyó, a 400 con el código estable
 * y lo que el cliente necesita (líneas no leídas, diferencia de saldos).
 */
function rechazoDePdf(
  codigo: string,
  mensaje: string,
  detalle: Record<string, unknown>,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: mensaje,
    error: codigo,
    ...detalle,
  });
}

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

const INDICE_LOTE = 'ux_cargas_company_id_hash_archivo';

/** CU-24: tamaño fijo del historial; sin paginación. */
export const LIMITE_LISTA_CARGAS = 20;

interface FilaListada {
  id: string;
  tipo: TipoCarga;
  nombre_archivo: string;
  estado: EstadoCarga;
  total_registros: number;
  registros_ok: number;
  registros_existentes: number;
  registros_error: number;
  banco: string | null;
  perfil: string | null;
  error_mensaje: string | null;
  subido_por: string | null;
  created_at: Date;
  procesada_at: Date | null;
  moneda_no_soportada: number;
}

@Injectable()
export class CargasService {
  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly cola: ColaCargas,
    private readonly perfiles: PerfilesBancarios,
    private readonly transaccion: TransaccionEmpresa,
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
      throw comoBadRequest(error);
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
   * Historias 3.2 y 3.3: lee un estado de cuenta en PDF, comprueba que sus
   * saldos cuadran y guarda lo que cuadra. Orden de las comprobaciones: el
   * lector (sin texto, ilegible, moneda), el cuadre de saldos y, solo si
   * cuadra, las líneas no leídas (con una sola, el PDF se rechaza: un falso
   * positivo es peor que no conciliar) y, al final, que haya al menos un
   * movimiento (`sin_movimientos`). Un rechazo no crea carga ni
   * movimientos y deja bitácora (`registrarRechazoDePdf`, fuera de la transacción de
   * la petición). Un PDF que pasa queda en 'pendiente_vista_previa' con sus
   * movimientos en espera, sin encolar nada. Nunca se guarda ni se registra el
   * contenido del archivo.
   */
  async guardarEstadoCuentaPdf(
    companyId: string,
    userId: string,
    archivo: ArchivoSubido,
    banco: string,
  ): Promise<RespuestaLecturaPdfDto> {
    const lector = lectorPdfDe(banco);
    if (!lector) {
      throw new BadRequestException(
        `Banco no soportado para PDF: "${banco.slice(0, 32)}". Disponibles: ${BANCOS_PDF.join(', ')}`,
      );
    }
    const idBanco = banco.trim().toLowerCase();
    const rechazo = {
      companyId,
      userId,
      archivo: archivo.originalname,
      banco: idBanco,
    };
    let leido: ReturnType<typeof lector>;
    try {
      leido = lector(await extraerTextoPdf(archivo.buffer));
    } catch (error) {
      if (error instanceof EstadoDeCuentaRechazado) {
        // Los rechazos sin código (periodo o saldos no encontrados) también
        // se registran, con un motivo genérico.
        await registrarRechazoDePdf(this.transaccion, {
          ...rechazo,
          motivo: error.codigo ?? 'pdf_no_reconocido',
        });
      }
      throw comoBadRequest(error);
    }

    const noLeidas: LineaNoLeida[] = leido.lineasNoLeidas;
    const conteos = {
      movimientosLeidos: leido.movimientos.length,
      lineasNoLeidas: noLeidas.length,
    };
    const cuadre = cuadrarSaldos({
      saldoInicial: leido.saldoInicial,
      saldoFinal: leido.saldoFinal,
      montos: leido.movimientos.map((m) => m.monto),
    });
    if (!cuadre.cuadra) {
      await registrarRechazoDePdf(this.transaccion, {
        ...rechazo,
        ...conteos,
        motivo: CODIGO_SALDOS_NO_CUADRAN,
      });
      throw rechazoDePdf(CODIGO_SALDOS_NO_CUADRAN, MENSAJE_SALDOS_NO_CUADRAN, {
        saldoEsperado: cuadre.saldoEsperado,
        diferencia: cuadre.diferencia,
        lineasNoLeidas: noLeidas,
      });
    }
    if (noLeidas.length > 0) {
      await registrarRechazoDePdf(this.transaccion, {
        ...rechazo,
        ...conteos,
        motivo: CODIGO_LINEAS_NO_LEIDAS,
      });
      throw rechazoDePdf(CODIGO_LINEAS_NO_LEIDAS, MENSAJE_LINEAS_NO_LEIDAS, {
        lineasNoLeidas: noLeidas,
      });
    }
    if (leido.movimientos.length === 0) {
      await registrarRechazoDePdf(this.transaccion, {
        ...rechazo,
        ...conteos,
        motivo: CODIGO_SIN_MOVIMIENTOS,
      });
      throw rechazoDePdf(CODIGO_SIN_MOVIMIENTOS, MENSAJE_SIN_MOVIMIENTOS, {
        lineasNoLeidas: [],
      });
    }

    const manager = this.contexto.manager();
    const hash = sha256(archivo.buffer);
    const carga =
      (await buscarPorHash(manager, companyId, hash)) ??
      (await crearCarga(manager, companyId, userId, {
        tipo: 'estado_cuenta',
        hash,
        nombre: nombreDelLote([archivo]),
        total: leido.movimientos.length,
        archivos: [],
        banco: idBanco,
        cuenta: null,
        perfil: null,
        estado: 'pendiente_vista_previa',
      }));
    // Si ya existía (también si ganó una subida simultánea), no se duplica
    // nada: ni movimientos, ni bitácora, ni job.
    if (!carga.yaExistia) {
      await guardarMovimientosPendientes(
        manager,
        companyId,
        carga.id,
        idBanco,
        leido.movimientos,
      );
      await registrarCargar(manager, companyId, carga.id);
    }
    return {
      banco: idBanco,
      saldoInicial: leido.saldoInicial,
      saldoFinal: leido.saldoFinal,
      movimientosLeidos: leido.movimientos.length,
      lineasNoLeidas: 0,
      cargaId: carga.id,
      estado: carga.estado,
      yaExistia: carga.yaExistia,
    };
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
   * CU-24: las últimas 20 cargas de la empresa. Una sola sentencia, solo
   * lectura. `monedaNoSoportada` cuenta las marcas del jsonb `resultados` (solo
   * CFDI), sin tocar las demás tablas. `users` no tiene company_id: el nombre se alcanza a través de la
   * carga ya filtrada por empresa. `id DESC` desempata `created_at` para que
   * el orden sea estable.
   */
  async listar(companyId: string): Promise<CargaListadaDto[]> {
    const filas = await this.contexto.manager().query<FilaListada[]>(
      `SELECT c.id, c.tipo, c.nombre_archivo, c.estado, c.total_registros,
              c.registros_ok, c.registros_existentes, c.registros_error,
              c.banco, c.perfil, c.error_mensaje, u.nombre AS subido_por,
              c.created_at, c.procesada_at,
              CASE WHEN c.tipo = 'cfdi'
                   AND jsonb_typeof(c.resultados) = 'array'
                   THEN (SELECT count(*)::int
                           FROM jsonb_array_elements(c.resultados) AS r
                          WHERE r ->> 'monedaNoSoportada' = 'true')
                   ELSE 0 END AS moneda_no_soportada
         FROM cargas c
         LEFT JOIN users u ON u.id = c.subido_por_id
        WHERE c.company_id = $1
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${LIMITE_LISTA_CARGAS}`,
      [companyId],
    );
    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      nombreArchivo: f.nombre_archivo,
      estado: f.estado,
      totalRegistros: f.total_registros,
      registrosOk: f.registros_ok,
      registrosExistentes: f.registros_existentes,
      registrosError: f.registros_error,
      banco: f.banco,
      perfil: f.perfil,
      errorMensaje: f.error_mensaje,
      subidoPor: f.subido_por,
      createdAt: f.created_at.toISOString(),
      procesadaAt: f.procesada_at?.toISOString() ?? null,
      monedaNoSoportada: f.moneda_no_soportada,
    }));
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
 * Crea la carga (en 'pendiente' salvo que se diga otro estado) con el total ya fijado. Si otra petición con
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
       VALUES ($1, $2, $10, $3, $4, $5, $6, $7, $8, $9)
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
        nueva.estado ?? 'pendiente',
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
