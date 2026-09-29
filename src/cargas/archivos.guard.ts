import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Injectable,
  mixin,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer, { MulterError } from 'multer';

const MB = 1024 * 1024;
const LARGO_NOMBRE = 255;
/**
 * Holgura del atajo por `Content-Length`: el cuerpo multipart pesa más que
 * los archivos (fronteras, encabezados de cada parte, campos de texto). El
 * tope exacto lo aplica el contador del almacenamiento, sobre los archivos.
 */
const HOLGURA_MULTIPART = 1 * MB;

export interface OpcionesDeArchivos {
  campo: string;
  extension: '.xml' | '.csv';
  maxArchivos: number;
  maxBytesPorArchivo: number;
  /** Suma de todos los archivos de la petición. */
  maxBytesPorPeticion: number;
  /** Campos de texto que acompañan a los archivos (van a un DTO). */
  maxCamposDeTexto: number;
}

/** CU-06: lote de CFDI. */
export const CAMPO_ARCHIVOS = 'archivos';
export const MAX_ARCHIVOS = 500;
export const MAX_BYTES_POR_ARCHIVO = 2 * MB;
/** Sin este tope, 500 × 2 MB = 1 GB en memoria por petición. */
export const MAX_BYTES_POR_PETICION = 50 * MB;

/** CU-09: un estado de cuenta. */
export const CAMPO_ESTADO_CUENTA = 'archivo';
export const MAX_BYTES_ESTADO_CUENTA = 10 * MB;

/**
 * Como `memoryStorage`, pero lleva la cuenta de lo que suma la petición y
 * corta en cuanto pasa el tope. Es la capa que cuenta de verdad: el
 * `Content-Length` puede no venir (chunked) o mentir.
 */
function memoriaConTope(
  maxBytes: number,
  mensaje: string,
): multer.StorageEngine {
  const usados = new WeakMap<Request, number>();
  return {
    _handleFile(solicitud, archivo, listo) {
      const partes: Buffer[] = [];
      let bytes = 0;
      let terminado = false;
      const fallar = (error: unknown) => {
        if (terminado) return;
        terminado = true;
        partes.length = 0;
        // Que el resto del archivo se descarte en vez de atorar a busboy.
        archivo.stream.resume();
        listo(error);
      };
      archivo.stream.on('data', (parte: Buffer) => {
        if (terminado) return;
        const total = (usados.get(solicitud) ?? 0) + parte.length;
        usados.set(solicitud, total);
        if (total > maxBytes) {
          fallar(new PayloadTooLargeException(mensaje));
          return;
        }
        partes.push(parte);
        bytes += parte.length;
      });
      archivo.stream.on('error', fallar);
      archivo.stream.on('end', () => {
        if (terminado) return;
        terminado = true;
        listo(null, { buffer: Buffer.concat(partes, bytes), size: bytes });
      });
    },
    _removeFile(_solicitud, archivo, listo) {
      archivo.buffer = Buffer.alloc(0);
      listo(null);
    },
  };
}

/**
 * Lee el multipart y deja `request.files` (y los campos de texto en
 * `request.body`, para el DTO del endpoint).
 *
 * Es guard y no el `FilesInterceptor` de Nest por el orden:
 * - Los guards globales (token, roles) corren antes: un revisor recibe su
 *   403 sin que se lea el cuerpo, y nadie sin token sube archivos a memoria.
 * - Los interceptores globales corren antes que los del endpoint: con
 *   `FilesInterceptor`, la transacción de empresa tendría tomada una
 *   conexión del pool mientras el cliente sube los archivos.
 *
 * Además, así los límites responden con motivo en español: 400 para los de
 * cada archivo, 413 para el total de la petición.
 */
export function ArchivosGuard(op: OpcionesDeArchivos): Type<CanActivate> {
  const demasiadoGrande = `La petición pasa de ${op.maxBytesPorPeticion / MB} MB`;
  const plural = op.maxArchivos === 1 ? 'archivo' : 'archivos';
  const motivos: Partial<Record<MulterError['code'], string>> = {
    LIMIT_FILE_SIZE: `Un archivo pasa de ${op.maxBytesPorArchivo / MB} MB`,
    LIMIT_FILE_COUNT: `Máximo ${op.maxArchivos} ${plural} por petición`,
    LIMIT_UNEXPECTED_FILE: `Máximo ${op.maxArchivos} ${plural} por petición, en el campo "${op.campo}"`,
    LIMIT_FIELD_COUNT: `Demasiados campos de texto; los archivos van en "${op.campo}"`,
  };

  const recibir = multer({
    storage: memoriaConTope(op.maxBytesPorPeticion, demasiadoGrande),
    // Nombres de archivo con acentos: sin esto multer los lee como latin1.
    defParamCharset: 'utf8',
    limits: {
      fileSize: op.maxBytesPorArchivo,
      files: op.maxArchivos,
      fields: op.maxCamposDeTexto,
    },
    fileFilter: (_solicitud, archivo, listo) => {
      if (!archivo.originalname.toLowerCase().endsWith(op.extension)) {
        listo(
          new BadRequestException(
            `Solo se aceptan archivos ${op.extension}: "${archivo.originalname}"`,
          ),
        );
        return;
      }
      // Tope de `carga_archivos.nombre` y de casi cualquier sistema de archivos.
      if ([...archivo.originalname].length > LARGO_NOMBRE) {
        listo(
          new BadRequestException(
            `Nombre de archivo de más de ${LARGO_NOMBRE} caracteres`,
          ),
        );
        return;
      }
      listo(null, true);
    },
  }).array(op.campo, op.maxArchivos);

  @Injectable()
  class GuardDeArchivos implements CanActivate {
    async canActivate(contexto: ExecutionContext): Promise<boolean> {
      const http = contexto.switchToHttp();
      const solicitud = http.getRequest<Request>();

      // Atajo barato antes de leer un byte. No basta: el header puede no
      // venir.
      const declarado = Number(solicitud.headers['content-length']);
      if (declarado > op.maxBytesPorPeticion + HOLGURA_MULTIPART) {
        throw new PayloadTooLargeException(demasiadoGrande);
      }

      await new Promise<void>((resolve, reject) => {
        recibir(solicitud, http.getResponse<Response>(), (error: unknown) => {
          if (!error) return resolve();
          if (error instanceof MulterError) {
            return reject(
              new BadRequestException(
                motivos[error.code] ?? `Multipart inválido: ${error.code}`,
              ),
            );
          }
          // El 400 del fileFilter o el 413 del almacenamiento pasan tal
          // cual; cualquier otra cosa es un multipart roto.
          reject(
            error instanceof HttpException
              ? error
              : new BadRequestException('Cuerpo multipart inválido'),
          );
        });
      });

      if (!solicitud.files || (solicitud.files as unknown[]).length === 0) {
        throw new BadRequestException(
          op.maxArchivos === 1
            ? `Falta el archivo en el campo "${op.campo}"`
            : `Falta al menos un archivo en el campo "${op.campo}"`,
        );
      }
      return true;
    }
  }
  return mixin(GuardDeArchivos);
}

export const ArchivosXmlGuard = ArchivosGuard({
  campo: CAMPO_ARCHIVOS,
  extension: '.xml',
  maxArchivos: MAX_ARCHIVOS,
  maxBytesPorArchivo: MAX_BYTES_POR_ARCHIVO,
  maxBytesPorPeticion: MAX_BYTES_POR_PETICION,
  maxCamposDeTexto: 0,
});

export const EstadoDeCuentaGuard = ArchivosGuard({
  campo: CAMPO_ESTADO_CUENTA,
  extension: '.csv',
  maxArchivos: 1,
  maxBytesPorArchivo: MAX_BYTES_ESTADO_CUENTA,
  maxBytesPorPeticion: MAX_BYTES_ESTADO_CUENTA,
  // banco y cuenta.
  maxCamposDeTexto: 2,
});
