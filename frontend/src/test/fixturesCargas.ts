import type {
  DetalleCarga,
  ItemCarga,
  PerfilBancario,
  RespuestaCarga,
} from '@/shared/api/contratos';
import type { EstadoCarga } from '@/shared/dominio';
import { idDe } from '@/test/fixturesBandeja';

// Cargas de ejemplo con la forma exacta que responde la API de cargas
// (CU-24). Las comparten las pruebas de contratos, de manejadores, de hooks,
// de pantalla y de flujos. Los contadores son números, nunca cadenas.

const BASE = Date.parse('2026-10-05T10:00:00.000Z');

/** Un instante `n` minutos antes del arranque: `n` mayor, más antiguo. */
export const hace = (n: number): string =>
  new Date(BASE - n * 60_000).toISOString();

/**
 * Una carga del historial. Ids deterministas: la misma `n` da siempre la
 * misma carga, y no chocan con las ids de la bandeja (usan 1-7999).
 */
export function itemCarga(n: number, o: Partial<ItemCarga> = {}): ItemCarga {
  return {
    id: idDe(9000 + n),
    tipo: 'cfdi',
    nombreArchivo: `lote-${n}.xml`,
    estado: 'procesada',
    registrosOk: 3,
    registrosError: 0,
    subidoPor: 'Luis Mendoza',
    createdAt: hace(n),
    ...o,
  };
}

/** Las veinte filas que devuelve el backend, la más nueva primero. */
export const LISTA_DE_VEINTE: readonly ItemCarga[] = Array.from(
  { length: 20 },
  (_, i) => itemCarga(i + 1),
);

/** Una carga por cada uno de los cinco estados, con su aspecto real. */
export const LISTA_CINCO_ESTADOS: readonly ItemCarga[] = [
  itemCarga(1, { estado: 'pendiente', registrosOk: 0, registrosError: 0 }),
  itemCarga(2, {
    estado: 'procesando',
    tipo: 'estado_cuenta',
    nombreArchivo: 'movimientos-septiembre.csv',
    registrosOk: 0,
    registrosError: 0,
  }),
  itemCarga(3, { estado: 'procesada', registrosOk: 1204 }),
  itemCarga(4, {
    estado: 'con_errores',
    registrosOk: 2,
    registrosError: 3,
    subidoPor: null,
  }),
  itemCarga(5, { estado: 'fallida', registrosOk: 0, registrosError: 0 }),
];

/** El detalle de una carga recién creada: nada procesado todavía. */
export function detalleCarga(
  n: number,
  o: Partial<DetalleCarga> = {},
): DetalleCarga {
  return {
    id: idDe(9000 + n),
    estado: 'pendiente',
    totalRegistros: 0,
    registrosOk: 0,
    registrosExistentes: 0,
    registrosError: 0,
    resultados: [],
    errorMensaje: null,
    ...o,
  };
}

/** CFDI terminado con un archivo nuevo, uno repetido y uno con error. */
export function detalleCfdiConErrores(n = 1): DetalleCarga {
  return detalleCarga(n, {
    estado: 'con_errores',
    totalRegistros: 3,
    registrosOk: 1,
    registrosExistentes: 1,
    registrosError: 1,
    resultados: [
      { archivo: 'a.xml', resultado: 'nuevo' },
      { archivo: 'b.xml', resultado: 'ya_existia' },
      { archivo: 'c.xml', resultado: 'error', motivo: 'XML mal formado' },
    ],
  });
}

/** Estado de cuenta terminado con dos filas rechazadas (4 y 17). */
export function detalleCsvConErrores(n = 2): DetalleCarga {
  return detalleCarga(n, {
    estado: 'con_errores',
    totalRegistros: 100,
    registrosOk: 98,
    registrosError: 2,
    resultados: [
      { fila: 4, resultado: 'error', motivo: 'Monto inválido' },
      { fila: 17, resultado: 'error', motivo: 'Fecha vacía' },
    ],
  });
}

/** El 202 de un lote nuevo: `pendiente`, contadores en cero, sin resultados. */
export function respuestaNueva(
  n = 1,
  o: Partial<RespuestaCarga> = {},
): RespuestaCarga {
  return { ...detalleCarga(n), yaExistia: false, ...o };
}

/**
 * El 200 de un lote que ya existía, en el estado que tenga la carga original.
 * Terminada trae los resultados; pendiente, procesando o fallida es un
 * reencolado.
 */
export function respuestaYaExistia(estado: EstadoCarga, n = 1): RespuestaCarga {
  const base: DetalleCarga =
    estado === 'procesada'
      ? detalleCarga(n, {
          estado,
          totalRegistros: 2,
          registrosOk: 0,
          registrosExistentes: 2,
          resultados: [
            { archivo: 'a.xml', resultado: 'ya_existia' },
            { archivo: 'b.xml', resultado: 'ya_existia' },
          ],
        })
      : estado === 'con_errores'
        ? detalleCfdiConErrores(n)
        : detalleCarga(n, {
            estado,
            errorMensaje:
              estado === 'fallida' ? 'No se pudo procesar la carga.' : null,
          });
  return { ...base, yaExistia: true };
}

/** `GET /bancos/perfiles`: un arreglo sin envoltorio, en orden del backend. */
export const PERFILES: readonly PerfilBancario[] = [
  { id: 'cuadra', nombre: 'Cuadra' },
  { id: 'banco-norte', nombre: 'Banco Norte' },
  { id: 'banco-sur', nombre: 'Banco Sur' },
];
