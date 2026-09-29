import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer, { MulterError } from 'multer';

export const CAMPO_ARCHIVOS = 'archivos';
export const MAX_ARCHIVOS = 500;
export const MAX_BYTES_POR_ARCHIVO = 2 * 1024 * 1024;
/** Sin este tope, 500 × 2 MB = 1 GB en memoria por petición. */
export const MAX_BYTES_POR_PETICION = 50 * 1024 * 1024;
const LARGO_NOMBRE = 255;

const DEMASIADO_GRANDE = `La petición pasa de ${MAX_BYTES_POR_PETICION / 1024 / 1024} MB`;

/**
 * Como `memoryStorage`, pero lleva la cuenta de lo que suma la petición y
 * corta en cuanto pasa el tope. Es la capa que cuenta de verdad: el
 * `Content-Length` puede no venir (chunked) o mentir.
 */
function memoriaConTope(maxBytes: number): multer.StorageEngine {
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
          fallar(new PayloadTooLargeException(DEMASIADO_GRANDE));
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
 * Lee el multipart de `archivos` y deja `request.files` (CU-06).
 *
 * Es guard y no el `FilesInterceptor` de Nest por el orden:
 * - Los guards globales (token, roles) corren antes: un revisor recibe su
 *   403 sin que se lea el cuerpo, y nadie sin token sube 50 MB a memoria.
 * - Los interceptores globales corren antes que los del endpoint: con
 *   `FilesInterceptor`, la transacción de empresa tendría tomada una
 *   conexión del pool mientras el cliente sube los archivos.
 *
 * Además, así los límites responden con motivo en español: 400 para los de
 * cada archivo, 413 para el total de la petición.
 */
const recibir = multer({
  storage: memoriaConTope(MAX_BYTES_POR_PETICION),
  // Nombres de archivo con acentos: sin esto multer los lee como latin1.
  defParamCharset: 'utf8',
  limits: {
    fileSize: MAX_BYTES_POR_ARCHIVO,
    files: MAX_ARCHIVOS,
    fields: 0,
  },
  fileFilter: (_solicitud, archivo, listo) => {
    if (!/\.xml$/i.test(archivo.originalname)) {
      listo(
        new BadRequestException(
          `Solo se aceptan archivos .xml: "${archivo.originalname}"`,
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
}).array(CAMPO_ARCHIVOS, MAX_ARCHIVOS);

const MOTIVOS: Partial<Record<MulterError['code'], string>> = {
  LIMIT_FILE_SIZE: `Un archivo pasa de ${MAX_BYTES_POR_ARCHIVO / 1024 / 1024} MB`,
  LIMIT_FILE_COUNT: `Máximo ${MAX_ARCHIVOS} archivos por petición`,
  LIMIT_UNEXPECTED_FILE: `Máximo ${MAX_ARCHIVOS} archivos por petición, todos en el campo "${CAMPO_ARCHIVOS}"`,
  LIMIT_FIELD_COUNT: `Solo se aceptan archivos en el campo "${CAMPO_ARCHIVOS}"`,
};

@Injectable()
export class ArchivosXmlGuard implements CanActivate {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const http = contexto.switchToHttp();
    const solicitud = http.getRequest<Request>();

    // Atajo barato antes de leer un byte. No basta: el header puede no venir.
    const declarado = Number(solicitud.headers['content-length']);
    if (declarado > MAX_BYTES_POR_PETICION) {
      throw new PayloadTooLargeException(DEMASIADO_GRANDE);
    }

    await new Promise<void>((resolve, reject) => {
      recibir(solicitud, http.getResponse<Response>(), (error: unknown) => {
        if (!error) return resolve();
        if (error instanceof MulterError) {
          return reject(
            new BadRequestException(
              MOTIVOS[error.code] ?? `Multipart inválido: ${error.code}`,
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
        `Falta al menos un archivo en el campo "${CAMPO_ARCHIVOS}"`,
      );
    }
    return true;
  }
}
