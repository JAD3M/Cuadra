import {
  BadRequestException,
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

const NUL = String.fromCharCode(0);
const PROFUNDIDAD_MAXIMA = 32;

/**
 * Postgres no guarda U+0000 en un `text` ni en un `jsonb`: un texto con ese
 * carácter llegaba a la base y la API respondía 500. Este pipe global corta
 * con un 400 antes de llegar a ella, en el cuerpo, la consulta y los
 * parámetros de la ruta, incluidos los textos anidados y los nombres de llave.
 * Va después del `ValidationPipe` (`configurarApp`): si un DTO ya rechaza el
 * carácter con su propio mensaje, ese mensaje es el que sale.
 */
@Injectable()
export class SinNulosPipe implements PipeTransform {
  transform(valor: unknown, metadata: ArgumentMetadata): unknown {
    if (
      (metadata.type === 'body' ||
        metadata.type === 'query' ||
        metadata.type === 'param') &&
      contieneNulo(valor, 0)
    ) {
      throw new BadRequestException(
        'La petición contiene caracteres no válidos',
      );
    }
    return valor;
  }
}

function contieneNulo(valor: unknown, profundidad: number): boolean {
  if (typeof valor === 'string') return valor.includes(NUL);
  if (typeof valor !== 'object' || valor === null) return false;
  // Más hondo que cualquier cuerpo legítimo: no se recorre sin fin.
  if (profundidad >= PROFUNDIDAD_MAXIMA) return true;
  if (Array.isArray(valor)) {
    return valor.some((v) => contieneNulo(v, profundidad + 1));
  }
  return Object.entries(valor).some(
    ([llave, v]) => llave.includes(NUL) || contieneNulo(v, profundidad + 1),
  );
}
