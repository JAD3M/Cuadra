import { idDe } from '@/test/fixturesBandeja';
import { USUARIO } from '@/test/fixtures';
import type { EventoBitacora } from '@/test/fixturesTolerancia';
import { idEvento } from '@/test/fixturesTolerancia';

// Eventos y personas de ejemplo de la bitácora (CU-26) con la forma exacta de
// `GET /bitacora` y `GET /bitacora/usuarios`: el listado trae `ip`, `userAgent`
// y el correo además de lo que pinta la pantalla (el contrato los descarta), y
// `datos` sale tal como lo escribe cada emisor del backend. Los comparten las
// pruebas de manejadores, de hooks y de flujos. Los eventos de la API NO
// traen el id del usuario: el manejador lo resuelve por correo.

/** Un id determinista de persona; no choca con los de bandeja, cargas ni eventos. */
export const idUsuario = (n: number): string => idDe(11_000 + n);

export interface PersonaBitacora {
  id: string;
  nombre: string;
  email: string;
}

/** Quién firma un evento de la API: nombre y correo, sin id. */
const ANA = { nombre: 'Ana Mendoza', email: 'ana.mendoza@despacho.mx' };
const LUIS = { nombre: 'Luis Reyes', email: 'luis.reyes@despacho.mx' };
/** La persona de la sesión de prueba (`fixtures.ts`). */
const JORGE = { nombre: USUARIO.nombre, email: USUARIO.email };

/** Las personas del filtro, en el orden de la maqueta. */
export const USUARIOS_BITACORA: readonly PersonaBitacora[] = [
  { id: idUsuario(1), ...ANA },
  { id: idUsuario(2), ...LUIS },
  { id: idUsuario(3), ...JORGE },
];

/** Id determinista de evento; arriba de los de tolerancia (10_000 + n). */
const idDeEvento = (n: number): string => idEvento(1_000 + n);

/** Un evento de `GET /bitacora` tal como llega por la red. */
export function eventoDeBitacora(
  n: number,
  o: Partial<EventoBitacora> = {},
): EventoBitacora {
  return {
    id: idDeEvento(n),
    entidad: 'conciliaciones',
    entidadId: idDe(20_000 + n),
    accion: 'confirmar',
    datos: {
      antes: { estado: 'propuesta' },
      despues: { estado: 'confirmada' },
      diferenciaMonto: '0.0000',
    },
    createdAt: '2026-09-18T22:02:00.000Z',
    usuario: LUIS,
    ip: '10.0.0.7',
    userAgent: 'Mozilla/5.0',
    ...o,
  };
}

const CFDI = idDe(30_001);
const MOVIMIENTO = idDe(30_002);

/**
 * Las siete filas de la maqueta (Bitacora.dc.html, v41) como las devuelve la
 * API, del más nuevo al más antiguo. Las horas de la maqueta son locales de
 * México (UTC-6): `16:02` es `22:02Z`. El detalle que muestra cada una:
 *  1 confirmar         propuesta → confirmada · diferencia $0.00
 *  2 acceso_denegado   PUT /empresa/tolerancia · rol insuficiente: requiere admin, tiene revisor
 *  3 rechazar          propuesta → rechazada · motivo: el CFDI corresponde a otra obra
 *  4 crear (regla)     propuesta · origen regla · diferencia $0.50
 *  5 crear (llm)       propuesta · origen llm
 *  6 actualizar        tolerancia_monto: $0.005 → $0.50
 *  7 rechazar          —  (datos sin la forma esperada)
 */
export const EVENTOS_MAQUETA: readonly EventoBitacora[] = [
  eventoDeBitacora(1, {
    entidadId: '0192a3f4-8c1e-7b2d-9f10-3e5c41a2d7b8',
    createdAt: '2026-09-18T22:02:00.000Z',
    usuario: LUIS,
    datos: {
      antes: { estado: 'propuesta' },
      despues: {
        estado: 'confirmada',
        confirmadaPorId: idUsuario(2),
        confirmadaAt: '2026-09-18T22:02:00.000Z',
      },
      cfdi: { id: CFDI, antes: 'abierta', despues: 'conciliada' },
      movimiento: { id: MOVIMIENTO, antes: 'abierto', despues: 'conciliado' },
      diferenciaMonto: '0.0000',
    },
  }),
  eventoDeBitacora(2, {
    entidad: 'companies',
    entidadId: '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
    accion: 'acceso_denegado',
    createdAt: '2026-09-18T21:47:00.000Z',
    usuario: JORGE,
    datos: {
      metodo: 'PUT',
      ruta: '/empresa/tolerancia',
      motivo: 'rol_insuficiente',
      rolesRequeridos: ['admin'],
      rolesDelUsuario: ['revisor'],
    },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
  }),
  eventoDeBitacora(3, {
    entidadId: '0192a3f4-3f9a-7c11-8d02-0c77e04b77d1',
    accion: 'rechazar',
    createdAt: '2026-09-18T18:30:00.000Z',
    usuario: LUIS,
    datos: {
      antes: { estado: 'propuesta', motivo: null },
      despues: {
        estado: 'rechazada',
        motivo: 'el CFDI corresponde a otra obra',
      },
      cfdiId: CFDI,
      movimientoId: MOVIMIENTO,
      diferenciaMonto: '0.5000',
    },
  }),
  eventoDeBitacora(4, {
    entidadId: '0192a3f4-b27d-7e10-9a3c-51c0a3f48c1e',
    accion: 'crear',
    createdAt: '2026-09-18T15:15:00.000Z',
    usuario: null,
    datos: {
      despues: { estado: 'propuesta' },
      origen: 'regla',
      regla: 'monto_exacto',
      score: '0.9500',
      diferenciaMonto: '0.5000',
      cfdiId: CFDI,
      movimientoId: MOVIMIENTO,
    },
    ip: null,
    userAgent: null,
  }),
  eventoDeBitacora(5, {
    entidadId: '0192a3f4-77d1-7a01-8b55-3f9a0c7712ab',
    accion: 'crear',
    createdAt: '2026-09-18T00:20:00.000Z',
    usuario: null,
    datos: {
      despues: { estado: 'propuesta' },
      origen: 'llm',
      regla: 'llm_sugerencia',
      modelo: 'modelo-de-prueba',
      inputHash: 'abc123',
      confianza: '0.8100',
      cfdiId: CFDI,
      movimientoId: MOVIMIENTO,
    },
    ip: null,
    userAgent: null,
  }),
  eventoDeBitacora(6, {
    entidad: 'companies',
    entidadId: '0191f2c0-51c0-7a3f-8e44-a3f4b27d9e10',
    accion: 'actualizar',
    createdAt: '2026-09-02T17:40:00.000Z',
    usuario: ANA,
    datos: { campo: 'tolerancia_monto', antes: '0.0050', despues: '0.5000' },
  }),
  eventoDeBitacora(7, {
    entidadId: '0192a3f4-e04b-7d77-9c20-41a28c1e3f9a',
    accion: 'rechazar',
    createdAt: '2026-09-01T16:05:00.000Z',
    usuario: ANA,
    datos: {},
  }),
];

const BASE = Date.parse('2026-09-18T22:00:00.000Z');

/**
 * `total` eventos de confirmación, del más nuevo al más antiguo (uno por
 * minuto), repartidos entre las tres personas y con un evento del sistema cada
 * siete. Para probar la paginación (`generarEventos(312)` son siete páginas de
 * 50, la última de 12).
 */
export function generarEventos(total: number): EventoBitacora[] {
  const personas = [ANA, LUIS, JORGE];
  return Array.from({ length: total }, (_, i) =>
    eventoDeBitacora(100 + i, {
      createdAt: new Date(BASE - i * 60_000).toISOString(),
      usuario: i % 7 === 6 ? null : (personas[i % 3] ?? ANA),
    }),
  );
}
