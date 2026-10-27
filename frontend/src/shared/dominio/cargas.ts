import type { EstadoCarga, TipoCarga } from './tipos';

// Espejo de lo que el backend define para las cargas fuera de
// src/common/entities/tipos.ts (CU-24, M9). El frontend no importa código del
// backend: copia los valores y tests/dominio/cargasEspejo.test.ts falla si el
// código de allá cambia. Al cambiar el backend, actualiza este archivo.

/** Los dos tipos de carga con nombre, para no escribir el literal en pantalla. */
export const TIPO_CFDI = 'cfdi' as const satisfies TipoCarga;
export const TIPO_ESTADO_CUENTA = 'estado_cuenta' as const satisfies TipoCarga;

/**
 * Activa: el servidor aún trabaja en ella. Concluida: terminó, bien o mal.
 * Es un `Record` sobre el espejo: un estado nuevo deja de compilar hasta
 * clasificarlo.
 */
export const FASE_CARGA: Readonly<Record<EstadoCarga, 'activa' | 'concluida'>> =
  {
    pendiente: 'activa',
    procesando: 'activa',
    procesada: 'concluida',
    con_errores: 'concluida',
    fallida: 'concluida',
  };

export const esActiva = (estado: EstadoCarga): boolean =>
  FASE_CARGA[estado] === 'activa';

export const esConcluida = (estado: EstadoCarga): boolean =>
  FASE_CARGA[estado] === 'concluida';

/** src/cargas/carga.entity.ts: `ResultadoDeArchivo`, en el orden de la entidad. */
export const RESULTADOS_ARCHIVO = ['nuevo', 'ya_existia', 'error'] as const;
export type ResultadoArchivo = (typeof RESULTADOS_ARCHIVO)[number];

/** El resultado de un archivo o una fila que no entró (lleva `motivo`). */
export const RESULTADO_ERROR = 'error' as const satisfies ResultadoArchivo;

/** src/bancos/perfiles-bancarios.ts: el perfil si el POST no dice otro. */
export const PERFIL_POR_DEFECTO = 'cuadra';

/** Cómo se manda el estado de cuenta: el CSV se importa, el PDF solo se lee. */
export type ModoEstadoCuenta = 'csv' | 'pdf';

/**
 * Bancos con lector de PDF (historia 3.2). No hay endpoint que los liste: es
 * un espejo de `src/bancos/pdf/lectores-pdf.ts`. El `id` es lo que espera el
 * POST (`banco`); el `nombre` es lo que ve la persona.
 */
export const BANCOS_PDF = [{ id: 'bbva', nombre: 'BBVA' }] as const;
export const BANCO_PDF_BBVA = BANCOS_PDF[0].id;

const MB = 1024 * 1024;

/**
 * Límites de src/cargas/archivos.guard.ts y de estado-cuenta.dto.ts. La
 * pantalla los usa solo como comodidad: el servidor decide.
 */
export const LIMITES_CARGA = {
  cfdi: {
    extension: '.xml',
    maxArchivos: 500,
    maxBytesPorArchivo: 2 * MB,
    maxBytesTotal: 50 * MB,
  },
  estadoCuenta: {
    extension: '.csv',
    maxBytesPorArchivo: 10 * MB,
    maxBanco: 128,
    maxCuenta: 32,
  },
  /** `POST /cargas/estado-cuenta/pdf`: un solo `.pdf` de hasta 10 MB. */
  estadoCuentaPdf: {
    extension: '.pdf',
    maxBytesPorArchivo: 10 * MB,
  },
} as const;
