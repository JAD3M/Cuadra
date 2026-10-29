import { describe, expect, it } from 'vitest';
import { ACCIONES_BITACORA, LIMITE_MAXIMO } from '@/shared/dominio';
import {
  eventoBitacora,
  respuestaListadoBitacora,
  respuestaUsuariosBitacora,
} from './bitacora';

const G = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Forma real de un evento de GET /bitacora, con claves que el contrato ignora. */
const evento = (n: number, o: Record<string, unknown> = {}) => ({
  id: G(n),
  entidad: 'conciliaciones',
  entidadId: G(100 + n),
  accion: 'confirmar',
  datos: { antes: { estado: 'propuesta' }, despues: { estado: 'confirmada' } },
  createdAt: '2026-09-18T22:02:00.000Z',
  usuario: { nombre: 'Luis Reyes', email: 'luis@cuadra.mx' },
  ip: '10.0.0.7',
  userAgent: 'Mozilla/5.0',
  ...o,
});

const listado = (o: Record<string, unknown> = {}) => ({
  datos: [evento(1)],
  pagina: 1,
  limite: 50,
  total: 1,
  ...o,
});

describe('eventoBitacora', () => {
  it('un rechazo sin entidad (entidadId null) es válido', () => {
    const r = eventoBitacora.safeParse(
      evento(1, { entidad: 'cargas', entidadId: null, accion: 'rechazar' }),
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.entidadId).toBeNull();
  });

  it('entidadId ausente sigue siendo inválido', () => {
    const sin: Record<string, unknown> = evento(1);
    delete sin.entidadId;
    expect(eventoBitacora.safeParse(sin).success).toBe(false);
  });

  it('acepta un evento válido y conserva lo que la pantalla pinta', () => {
    const r = eventoBitacora.safeParse(evento(1));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      id: G(1),
      entidad: 'conciliaciones',
      entidadId: G(101),
      accion: 'confirmar',
      datos: {
        antes: { estado: 'propuesta' },
        despues: { estado: 'confirmada' },
      },
      createdAt: '2026-09-18T22:02:00.000Z',
      usuario: { nombre: 'Luis Reyes' },
    });
  });

  it('descarta ip, userAgent y el correo del usuario (BIT-1.4)', () => {
    const r = eventoBitacora.parse(evento(1));
    expect('ip' in r).toBe(false);
    expect('userAgent' in r).toBe(false);
    expect(r.usuario).not.toBeNull();
    expect(r.usuario !== null && 'email' in r.usuario).toBe(false);
  });

  it('acepta usuario nulo y datos nulos', () => {
    const r = eventoBitacora.safeParse(
      evento(2, { usuario: null, datos: null }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.usuario).toBeNull();
    expect(r.data.datos).toBeNull();
  });

  it.each(ACCIONES_BITACORA)('acepta la acción %s del espejo', (accion) => {
    expect(eventoBitacora.safeParse(evento(1, { accion })).success).toBe(true);
  });

  it('rechaza una acción desconocida (enum estricto)', () => {
    expect(
      eventoBitacora.safeParse(evento(1, { accion: 'cargas' })).success,
    ).toBe(false);
    expect(eventoBitacora.safeParse(evento(1, { accion: '' })).success).toBe(
      false,
    );
  });

  it('rechaza id o entidadId que no son guid', () => {
    expect(eventoBitacora.safeParse(evento(1, { id: 'abc' })).success).toBe(
      false,
    );
    expect(
      eventoBitacora.safeParse(evento(1, { entidadId: '123' })).success,
    ).toBe(false);
  });

  it('rechaza createdAt que no es una cadena ISO', () => {
    expect(
      eventoBitacora.safeParse(evento(1, { createdAt: '18/09/2026' })).success,
    ).toBe(false);
    expect(
      eventoBitacora.safeParse(evento(1, { createdAt: 1789768920000 })).success,
    ).toBe(false);
  });

  it('rechaza entidad vacía y usuario con nombre vacío', () => {
    expect(eventoBitacora.safeParse(evento(1, { entidad: '' })).success).toBe(
      false,
    );
    expect(
      eventoBitacora.safeParse(evento(1, { usuario: { nombre: '' } })).success,
    ).toBe(false);
  });

  it('datos solo admite objeto o nulo: un arreglo o un texto fallan', () => {
    expect(eventoBitacora.safeParse(evento(1, { datos: [] })).success).toBe(
      false,
    );
    expect(eventoBitacora.safeParse(evento(1, { datos: 'x' })).success).toBe(
      false,
    );
  });
});

describe('respuestaListadoBitacora', () => {
  it('acepta el sobre completo', () => {
    const r = respuestaListadoBitacora.safeParse(listado());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.datos).toHaveLength(1);
    expect(r.data.total).toBe(1);
  });

  it('rechaza un sobre sin total', () => {
    const sinTotal: Record<string, unknown> = listado();
    delete sinTotal.total;
    expect(respuestaListadoBitacora.safeParse(sinTotal).success).toBe(false);
  });

  it('rechaza conteos que no son enteros', () => {
    expect(
      respuestaListadoBitacora.safeParse(listado({ total: 1.5 })).success,
    ).toBe(false);
    expect(
      respuestaListadoBitacora.safeParse(listado({ pagina: 1.5 })).success,
    ).toBe(false);
  });

  it('rechaza un limite por encima de LIMITE_MAXIMO y acepta el tope', () => {
    expect(
      respuestaListadoBitacora.safeParse(listado({ limite: LIMITE_MAXIMO + 1 }))
        .success,
    ).toBe(false);
    expect(
      respuestaListadoBitacora.safeParse(listado({ limite: LIMITE_MAXIMO }))
        .success,
    ).toBe(true);
  });

  it('rechaza pagina 0 y total negativo', () => {
    expect(
      respuestaListadoBitacora.safeParse(listado({ pagina: 0 })).success,
    ).toBe(false);
    expect(
      respuestaListadoBitacora.safeParse(listado({ total: -1 })).success,
    ).toBe(false);
  });

  it('un evento mal formado dentro de datos rompe todo el sobre', () => {
    const r = respuestaListadoBitacora.safeParse(
      listado({ datos: [evento(1), evento(2, { accion: 'otra' })] }),
    );
    expect(r.success).toBe(false);
  });

  it('acepta una lista vacía con total 0', () => {
    const r = respuestaListadoBitacora.safeParse(
      listado({ datos: [], total: 0 }),
    );
    expect(r.success).toBe(true);
  });
});

describe('respuestaUsuariosBitacora', () => {
  it('acepta { datos: [{ id, nombre }] }', () => {
    const r = respuestaUsuariosBitacora.safeParse({
      datos: [
        { id: G(1), nombre: 'Ana Reyes' },
        { id: G(2), nombre: 'Jorge Tapia' },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.datos.map((u) => u.nombre)).toEqual([
      'Ana Reyes',
      'Jorge Tapia',
    ]);
  });

  it('rechaza un elemento sin nombre o con id que no es guid', () => {
    expect(
      respuestaUsuariosBitacora.safeParse({ datos: [{ id: G(1) }] }).success,
    ).toBe(false);
    expect(
      respuestaUsuariosBitacora.safeParse({
        datos: [{ id: 'x', nombre: 'Ana' }],
      }).success,
    ).toBe(false);
  });
});
