import { CAMPO_TOLERANCIA } from '@/shared/dominio';
import { idDe } from '@/test/fixturesBandeja';

// Eventos de bitácora de ejemplo con la forma exacta de `GET /bitacora`
// (CU-25): el listado trae `ip` y `userAgent` además de lo que pinta la
// pantalla, y `datos` sale tal como se guardó, de modo que también hay filas
// ajenas a la tolerancia que la lista debe tolerar. Los comparten las pruebas
// de contratos, de manejadores, de hooks y de flujos.

const BASE = Date.parse('2026-10-05T10:00:00.000Z');

/** Un instante `n` minutos antes del arranque: `n` mayor, más antiguo. */
export const hace = (n: number): string =>
  new Date(BASE - n * 60_000).toISOString();

/** Un evento de `GET /bitacora` tal como llega por la red. */
export interface EventoBitacora {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  datos: unknown;
  createdAt: string;
  usuario: { nombre: string; email: string } | null;
  ip: string | null;
  userAgent: string | null;
}

const ANA = { nombre: 'Ana Mendoza', email: 'ana.mendoza@despacho.mx' };

/** Un id determinista que no choca con los de bandeja (1-7999) ni cargas (9000+). */
export const idEvento = (n: number): string => idDe(10_000 + n);

/** Un cambio de tolerancia: `n` mayor, más antiguo. */
export function eventoTolerancia(
  n: number,
  o: Partial<EventoBitacora> = {},
): EventoBitacora {
  return {
    id: idEvento(n),
    entidad: 'companies',
    entidadId: idDe(1),
    accion: 'actualizar',
    datos: { campo: CAMPO_TOLERANCIA, antes: '1.0000', despues: '0.5000' },
    createdAt: hace(n),
    usuario: ANA,
    ip: '127.0.0.1',
    userAgent: 'vitest',
    ...o,
  };
}

/** Otro cambio de la misma empresa que NO es de tolerancia (otro `campo`). */
export function eventoAjeno(
  n: number,
  o: Partial<EventoBitacora> = {},
): EventoBitacora {
  return eventoTolerancia(n, {
    datos: { campo: 'razon_social', antes: 'Anterior SA', despues: 'Nueva SA' },
    ...o,
  });
}

/** Lo que dejan los eventos del motor de reglas: sin usuario y sin `campo`. */
export function eventoHeredado(
  n: number,
  o: Partial<EventoBitacora> = {},
): EventoBitacora {
  return eventoTolerancia(n, {
    datos: { origen: 'regla' },
    usuario: null,
    ...o,
  });
}

/**
 * El arranque del almacén: dos cambios de tolerancia (el último deja el valor
 * en 0.5000, el de arranque del manejador) entre ruido que la lista ignora.
 * Del más nuevo al más antiguo, como responde el servidor.
 */
export const CAMBIOS_INICIALES: readonly EventoBitacora[] = [
  eventoTolerancia(1),
  eventoAjeno(2),
  eventoTolerancia(3, { datos: null }),
  eventoTolerancia(4, {
    datos: { campo: CAMPO_TOLERANCIA, antes: '0.0050', despues: '1.0000' },
    usuario: null,
  }),
  eventoHeredado(5),
];

/**
 * Cincuenta eventos (el `limite` de la consulta) con solo diez de tolerancia
 * mezclados entre ruido: pone a prueba el filtro y el recorte a cinco.
 */
export const CAMBIOS_RUIDOSOS: readonly EventoBitacora[] = Array.from(
  { length: 50 },
  (_, i) => {
    const n = i + 1;
    if (n % 5 !== 0) return n % 2 === 0 ? eventoAjeno(n) : eventoHeredado(n);
    return eventoTolerancia(n, {
      datos: {
        campo: CAMPO_TOLERANCIA,
        antes: `${n}.0000`,
        despues: `${n + 1}.0000`,
      },
    });
  },
);
