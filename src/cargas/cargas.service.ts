import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { QueryFailedError } from 'typeorm';
import { CfdiRechazado } from '../cfdi/cfdi-leido';
import { leerCfdi } from '../cfdi/lector-cfdi';
import type { EstadoCarga } from '../common/entities/tipos';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { ErrorDeArchivo } from './carga.entity';

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
  registrosError: number;
  errores: ErrorDeArchivo[];
}

interface FilaCarga {
  id: string;
  estado: EstadoCarga;
  total_registros: number;
  registros_ok: number;
  registros_error: number;
  errores: ErrorDeArchivo[];
}

/** Tope de la columna `cargas.nombre_archivo`. */
const LARGO_NOMBRE = 512;

const SQL_ESTADO = `id, estado, total_registros, registros_ok, registros_error, errores`;

@Injectable()
export class CargasService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  /**
   * CU-06, síncrono dentro de la petición (la cola es CU-08). Una fila en
   * `cargas` por petición; cada archivo en su propio SAVEPOINT, así que uno
   * que falla no se lleva a los demás.
   */
  async cargarCfdi(
    companyId: string,
    userId: string,
    archivos: readonly ArchivoSubido[],
  ): Promise<EstadoDeCarga> {
    const manager = this.contexto.manager();

    let cargaId: string;
    try {
      [{ id: cargaId }] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO cargas
           (company_id, tipo, estado, nombre_archivo, hash_archivo,
            total_registros, subido_por_id)
         VALUES ($1, 'cfdi', 'procesando', $2, $3, $4, $5)
         RETURNING id`,
        [
          companyId,
          nombreDelLote(archivos),
          hashDelLote(archivos),
          archivos.length,
          userId,
        ],
      );
    } catch (error) {
      // El resto de la idempotencia (devolver la carga previa, etc.) es CU-07.
      if (violaIndice(error, 'ux_cargas_company_id_hash_archivo')) {
        throw new ConflictException('Este lote de archivos ya se cargó');
      }
      throw error;
    }

    const errores: ErrorDeArchivo[] = [];
    for (const archivo of archivos) {
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
            // Texto directo a timestamp sin zona: pasar por Date lo movería
            // a la zona del servidor.
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
      } catch (error) {
        const motivo = motivoDelArchivo(error);
        // No es culpa del archivo (conexión, permisos, un bug, una Serie más
        // larga que su columna): se aborta la petición entera. El
        // interceptor hace rollback de todo, incluida la fila de cargas, y
        // Nest responde 500. Reportarlo como fallo del archivo escondería un
        // problema nuestro detrás de "el CFDI venía mal".
        if (motivo === null) throw error;
        // Sin esto, el error de BD del UUID repetido deja la transacción
        // abortada y todo lo que sigue falla con "current transaction is
        // aborted".
        await manager.query('ROLLBACK TO SAVEPOINT archivo');
        errores.push({ archivo: archivo.originalname, motivo });
      }
    }

    const ok = archivos.length - errores.length;
    const estado: EstadoCarga = ok > 0 ? 'procesada' : 'fallida';
    // Con UPDATE, el driver de Postgres devuelve [filas, afectadas].
    const [filas] = await manager.query<[FilaCarga[], number]>(
      `UPDATE cargas
          SET estado = $1, registros_ok = $2, registros_error = $3,
              errores = $4::jsonb, procesada_at = now(), updated_at = now()
        WHERE id = $5 AND company_id = $6
        RETURNING ${SQL_ESTADO}`,
      [estado, ok, errores.length, JSON.stringify(errores), cargaId, companyId],
    );
    return aEstado(filas[0]);
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

/**
 * Motivo si el error es del archivo, `null` si no. Del archivo son solo dos:
 * lo que rechaza el lector y el UUID que ya existe en la empresa.
 */
function motivoDelArchivo(error: unknown): string | null {
  if (error instanceof CfdiRechazado) return error.message;
  if (violaIndice(error, 'ux_cfdi_company_id_uuid_fiscal')) {
    return 'El UUID de este CFDI ya existe en la empresa';
  }
  return null;
}

function aEstado(fila: FilaCarga): EstadoDeCarga {
  return {
    id: fila.id,
    estado: fila.estado,
    totalRegistros: fila.total_registros,
    registrosOk: fila.registros_ok,
    registrosError: fila.registros_error,
    errores: fila.errores,
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
