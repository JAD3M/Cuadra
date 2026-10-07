import { describe, expect, it } from 'vitest';
import { clavesBitacora, useEpoca } from './claves';
import type { ConsultaBitacora } from './consulta';

const CONSULTA: ConsultaBitacora = { accion: 'crear', pagina: 1, limite: 50 };

describe('claves de la bitácora', () => {
  it('la época va en la posición 1 y no hay token en ninguna clave', () => {
    expect(clavesBitacora.todas(3)).toEqual(['bitacora', 3]);
    expect(clavesBitacora.lista(3, CONSULTA)).toEqual([
      'bitacora',
      3,
      'lista',
      CONSULTA,
    ]);
    expect(clavesBitacora.usuarios(3)).toEqual(['bitacora', 3, 'usuarios']);
  });

  it('todas(e) es prefijo de la lista y de los usuarios de esa época', () => {
    const prefijo = clavesBitacora.todas(4);
    expect(clavesBitacora.lista(4, CONSULTA).slice(0, 2)).toEqual(prefijo);
    expect(clavesBitacora.usuarios(4).slice(0, 2)).toEqual(prefijo);
  });

  it('la misma consulta da la misma clave, aunque sus claves vengan en otro orden', () => {
    expect(
      clavesBitacora.lista(1, { limite: 50, pagina: 1, accion: 'crear' }),
    ).toEqual(clavesBitacora.lista(1, CONSULTA));
  });

  it('otra época, filtro, rango, página o límite cambia la clave', () => {
    const base = clavesBitacora.lista(1, CONSULTA);
    for (const otra of [
      clavesBitacora.lista(2, CONSULTA),
      clavesBitacora.lista(1, { ...CONSULTA, accion: 'rechazar' }),
      clavesBitacora.lista(1, { ...CONSULTA, entidad: 'companies' }),
      clavesBitacora.lista(1, {
        ...CONSULTA,
        userId: '3f2b7c1e-9a4d-4e6b-8c15-2d7a90b4e1f3',
      }),
      clavesBitacora.lista(1, {
        ...CONSULTA,
        desde: '2026-09-01T06:00:00.000Z',
      }),
      clavesBitacora.lista(1, {
        ...CONSULTA,
        hasta: '2026-10-01T06:00:00.000Z',
      }),
      clavesBitacora.lista(1, { ...CONSULTA, pagina: 2 }),
      clavesBitacora.lista(1, { ...CONSULTA, limite: 20 }),
    ]) {
      expect(otra).not.toEqual(base);
    }
    expect(clavesBitacora.usuarios(2)).not.toEqual(clavesBitacora.usuarios(1));
  });

  it('la lista y los usuarios no comparten clave', () => {
    expect(clavesBitacora.lista(1, CONSULTA)).not.toEqual(
      clavesBitacora.usuarios(1),
    );
  });

  it('una consulta nula tiene su propia clave', () => {
    expect(clavesBitacora.lista(1, null)).toEqual([
      'bitacora',
      1,
      'lista',
      null,
    ]);
    expect(clavesBitacora.lista(1, null)).not.toEqual(
      clavesBitacora.lista(1, CONSULTA),
    );
  });

  it('no comparte prefijo con los cambios de la tolerancia', () => {
    expect(clavesBitacora.todas(1)[0]).toBe('bitacora');
    expect(clavesBitacora.todas(1)[0]).not.toBe('tolerancia');
  });

  it('sin sesión lista la época es null y la clave lo conserva', () => {
    expect(clavesBitacora.usuarios(null)).toEqual([
      'bitacora',
      null,
      'usuarios',
    ]);
  });

  it('reexporta el hook de época de la bandeja', () => {
    expect(typeof useEpoca).toBe('function');
  });
});
